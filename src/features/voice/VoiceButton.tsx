import { AudioModule, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ChatBubble, Chip, Txt, formatINR } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { createTask, getMembers, submitExpense, updateTaskStatus } from '@/lib/api';
import { sayNow } from '@/lib/say';
import type { Lang, TaskStatus } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { useFlag, useWedding } from '@/lib/wedding';

import {
  speakAndWait,
  stopSpeaking,
  understand,
  VOICE_RECORDING,
  warmUpVoice,
  type Turn,
  type VoiceAction,
  type VoiceResult,
} from './voice';

// Silence detection (lessons from Basket): loud = speech; nobody spoke = don't send.
const SPEECH_DB = -42;
const MIN_SPEECH_MS = 300;
const END_SILENCE_MS = 1200; // conversation: stop by itself after this much quiet following speech
const NO_SPEECH_MS = 8000; // conversation: nobody spoke in this turn
const IDLE_END_MS = 20000; // conversation: end after this much total silence
const MAX_TURN_MS = 15000;

const HINTS: { code: Lang | 'auto'; label: string }[] = [
  { code: 'auto', label: 'Auto' },
  { code: 'od-IN', label: 'ଓଡ଼ିଆ' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'en-IN', label: 'English' },
];

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'saving';
type Pending = Extract<VoiceAction, { intent: 'expense' } | { intent: 'task' }>;

/**
 * Talk to Wedora in Odia / Hindi / Bengali / English.
 * - Tap-to-talk: tap, speak, tap; confirm with the buttons.
 * - Conversation: tap once; Wedora listens, stops when you pause, answers aloud, and listens again.
 *   Say "yes"/"ହଁ"/"हाँ"/"হ্যাঁ" to save, "no" to cancel, "stop" to end. Money is always confirm-first.
 * Visible only when Flagsmith turns on voice_expense for this level (and the ai_voice kill switch is on).
 */
export function VoiceButton() {
  const on = useFlag('voice_expense');
  const { member, wedding } = useWedding();
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const state = useAudioRecorderState(recorder, 100);

  const [phase, setPhase] = useState<Phase>('idle');
  const [conv, setConv] = useState(false);
  const [hint, setHint] = useState<Lang | 'auto'>(member?.language ?? 'auto');
  const [lines, setLines] = useState<Turn[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [undo, setUndo] = useState<{ task_id: string; from: TaskStatus; title: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [timing, setTiming] = useState<VoiceResult['ms'] | null>(null);

  // Refs so the conversation loop always sees the latest values.
  const convRef = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const turn = useRef({ startedAt: 0, speechAt: 0, lastLoudAt: 0, peak: -160, stopping: false });
  const idleSince = useRef(0);
  const langRef = useRef<Lang>(member?.language ?? 'en-IN');

  useEffect(() => {
    warmUpVoice();
    return () => {
      convRef.current = false;
      stopSpeaking();
    };
  }, []);

  // Watch loudness while recording: end the turn by itself in conversation mode.
  useEffect(() => {
    if (!state.isRecording) return;
    const t = turn.current;
    const now = Date.now();
    const db = typeof state.metering === 'number' ? state.metering : null;
    if (db !== null) {
      t.peak = Math.max(t.peak, db);
      if (db > SPEECH_DB) {
        if (!t.speechAt) t.speechAt = now;
        t.lastLoudAt = now;
      }
    }
    if (!convRef.current || t.stopping) return;
    const spoke = t.speechAt && t.lastLoudAt - t.speechAt >= MIN_SPEECH_MS;
    if (spoke && now - t.lastLoudAt > END_SILENCE_MS) void stopTurn();
    else if (!t.speechAt && now - t.startedAt > NO_SPEECH_MS) void stopTurn();
    else if (now - t.startedAt > MAX_TURN_MS) void stopTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.metering, state.durationMillis]);

  if (!on || !member || !wedding) return null;
  const w = wedding.id;

  const addLine = (l: Turn) => {
    historyRef.current = [...historyRef.current, l].slice(-8);
    setLines(historyRef.current.slice(-6));
  };
  const setPend = (p: Pending | null) => {
    pendingRef.current = p;
    setPending(p);
  };

  async function say(textEn: string, local?: string) {
    const text = local || (await sayNow(langRef.current, textEn));
    if (!text.trim()) return;
    addLine({ role: 'ai', text });
    setPhase('speaking');
    await speakAndWait(text, langRef.current, w);
  }

  async function startTurn() {
    setMessage(null);
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      endConversation();
      setMessage({ text: 'Please allow the microphone to talk to Wedora.', bad: true });
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    turn.current = { startedAt: Date.now(), speechAt: 0, lastLoudAt: 0, peak: -160, stopping: false };
    recorder.record();
    setPhase('listening');
  }

  async function stopTurn() {
    const t = turn.current;
    if (t.stopping) return;
    t.stopping = true;
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const heard = t.speechAt > 0 || (t.peak > -160 && t.peak >= SPEECH_DB);
    const long = Date.now() - t.startedAt >= 600;
    if (!heard || !long || !recorder.uri) {
      if (convRef.current) {
        if (!idleSince.current) idleSince.current = t.startedAt;
        if (Date.now() - idleSince.current > IDLE_END_MS) {
          await say('I will stop listening now. Tap the mic when you need me.');
          endConversation();
        } else {
          void startTurn(); // keep listening quietly
        }
      } else {
        setPhase('idle');
        setMessage({ text: await sayNow(langRef.current, "I didn't hear anything. Hold the phone close and try again."), bad: true });
      }
      return;
    }
    idleSince.current = 0;
    setPhase('thinking');
    try {
      const r = await understand(recorder.uri, w, hint, { pending: pendingRef.current, history: historyRef.current });
      langRef.current = r.language;
      setTiming(r.ms ?? null);
      if (r.transcript) addLine({ role: 'me', text: r.transcript });
      await handle(r);
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true });
      if (convRef.current) await say('That did not go through. Please say it again.');
    }
    if (convRef.current) void startTurn();
    else setPhase('idle');
  }

  async function handle(r: VoiceResult) {
    const a = r.action;
    switch (a.intent) {
      case 'expense':
      case 'task':
        setPend(a);
        await say(r.reply_en ?? '', r.reply);
        return;
      case 'confirm':
        await doConfirm();
        return;
      case 'cancel':
        setPend(null);
        await say('', r.reply);
        return;
      case 'task_status': {
        setPhase('saving');
        await updateTaskStatus(a.task_id, a.status);
        setUndo({ task_id: a.task_id, from: a.from as TaskStatus, title: a.title });
        await say('', r.reply);
        return;
      }
      case 'stop':
        await say('', r.reply || (await sayNow(langRef.current, 'Ending the conversation.')));
        endConversation();
        return;
      default:
        await say('', r.reply);
    }
  }

  /** Save the pending action through the same permission-checked server path as the buttons. */
  async function doConfirm() {
    const p = pendingRef.current;
    if (!p) return;
    setPhase('saving');
    try {
      let doneEn = '';
      if (p.intent === 'expense') {
        const r = await submitExpense(w, { amount: p.amount, description: p.description, paid_to: p.paid_to, source: 'voice' });
        const members = await getMembers(w);
        const appr = members.find((x) => x.id === r.expense.approver_id);
        const why =
          r.expense.approval_level === 'sub_head'
            ? `up to ${formatINR(r.limits.sub_head)}`
            : r.expense.approval_level === 'head'
              ? `above ${formatINR(r.limits.sub_head)}`
              : `above ${formatINR(r.limits.head)}`;
        doneEn = `Recorded. ${formatINR(p.amount)} has been sent to ${appr?.display_name ?? 'the approver'} (${ROLE_LABEL[appr?.role ?? 'admin']}) for approval, as it is ${why}.`;
      } else {
        await createTask(p.department_id ?? member!.department_id ?? '', p.title, null, 'voice');
        doneEn = `Task recorded for ${p.department}: ${p.title}.`;
      }
      setPend(null);
      const local = await sayNow(langRef.current, doneEn);
      setMessage({ text: local });
      await say(doneEn, local);
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true });
      await say('I could not record that. Please try again.');
    }
  }

  async function undoStatus() {
    if (!undo) return;
    await updateTaskStatus(undo.task_id, undo.from);
    setMessage({ text: `Undone: "${undo.title}" is back to ${undo.from.replace('_', ' ')}.` });
    setUndo(null);
  }

  function startConversation() {
    convRef.current = true;
    setConv(true);
    idleSince.current = 0;
    langRef.current = hint === 'auto' ? member!.language : hint;
    void (async () => {
      await say('Namaste. I am listening. Tell me a payment, a task, or ask for a status update.');
      if (convRef.current) void startTurn();
    })();
  }

  function endConversation() {
    convRef.current = false;
    setConv(false);
    stopSpeaking();
    if (recorder.isRecording) {
      turn.current.stopping = true;
      void recorder.stop();
    }
    setPhase('idle');
  }

  const listening = phase === 'listening';
  const busy = phase === 'thinking' || phase === 'saving';
  const status =
    phase === 'listening'
      ? conv
        ? 'Listening… just pause when you finish'
        : 'Listening… tap to stop'
      : phase === 'thinking'
        ? 'Understanding…'
        : phase === 'speaking'
          ? 'Wedora is speaking…'
          : phase === 'saving'
            ? 'Saving…'
            : conv
              ? ''
              : 'Tap and speak';

  return (
    <Card style={styles.card}>
      <View style={styles.hints}>
        {HINTS.map((h) => (
          <Chip key={h.code} label={h.label} selected={hint === h.code} onPress={() => setHint(h.code)} />
        ))}
      </View>

      <Pressable
        accessibilityLabel={conv ? 'End conversation' : listening ? 'Stop recording' : 'Tap and speak'}
        onPress={conv ? endConversation : listening ? () => void stopTurn() : () => void startTurn()}
        disabled={busy && !conv}
        style={({ pressed }) => [styles.mic, (listening || conv) && styles.micOn, pressed && { opacity: 0.85 }]}
      >
        {busy ? <ActivityIndicator color={C.white} size="large" /> : <Txt style={styles.micIcon}>{conv ? '✕' : listening ? '■' : '🎙️'}</Txt>}
      </Pressable>
      <Txt variant="h3" center>
        {status}
      </Txt>

      {!conv && phase === 'idle' ? (
        <Button title="Talk with Wedora (hands-free)" icon="💬" variant="secondary" size="md" onPress={startConversation} />
      ) : null}
      {conv ? (
        <Txt variant="small" color={C.inkSoft} center>
          Say “yes / ହଁ / हाँ / হ্যাঁ” to save · “no” to cancel · “stop” to end
        </Txt>
      ) : (
        <Txt variant="small" color={C.inkSoft} center>
          e.g. “ମାମୁ ଟେଣ୍ଟ ୱାଲାକୁ ୧୨ ହଜାର ଦେଲେ” · “Mamu paid 12,000 to the tent-wala” · “How much has Decoration spent?”
        </Txt>
      )}

      {lines.map((l, i) => (
        <ChatBubble key={`${i}-${l.text.slice(0, 12)}`} from={l.role} text={l.text} />
      ))}

      {pending ? (
        <Card style={styles.action}>
          <Txt variant="caption" color={C.inkSoft}>
            {pending.intent === 'expense' ? 'EXPENSE · waiting for your yes' : `TASK · ${pending.department}`}
          </Txt>
          {pending.intent === 'expense' ? (
            <>
              <Txt variant="title">{formatINR(pending.amount)}</Txt>
              <Txt variant="body">
                {pending.description}
                {pending.paid_to ? ` · paid to ${pending.paid_to}` : ''}
              </Txt>
            </>
          ) : (
            <Txt variant="h3">{pending.title}</Txt>
          )}
          <View style={styles.row}>
            <Button title="Confirm" variant="success" inline onPress={() => void doConfirm()} />
            <Button title="Cancel" variant="secondary" inline onPress={() => setPend(null)} />
          </View>
        </Card>
      ) : null}

      {undo ? (
        <View style={styles.row}>
          <Txt variant="small" color={C.leaf} style={{ flex: 1 }}>
            ✓ “{undo.title}” updated
          </Txt>
          <Button title="Undo" variant="ghost" size="sm" inline onPress={() => void undoStatus()} />
        </View>
      ) : null}

      {message ? (
        <Txt variant="body" color={message.bad ? C.danger : C.leaf} center>
          {message.text}
        </Txt>
      ) : null}
      {timing?.total ? (
        <Txt variant="caption" color={C.inkSoft} center>
          Sarvam: heard in {((timing.stt ?? 0) / 1000).toFixed(1)} s · understood in {((timing.llm ?? 0) / 1000).toFixed(1)} s
        </Txt>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'stretch', gap: S.md },
  hints: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, justifyContent: 'center' },
  mic: {
    alignSelf: 'center',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: C.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: C.marigoldSoft,
  },
  micOn: { backgroundColor: C.maroon, borderColor: C.maroonSoft },
  micIcon: { fontSize: 44, lineHeight: 52, color: C.white },
  action: { gap: S.sm, borderColor: C.marigold, borderWidth: 2 },
  row: { flexDirection: 'row', gap: S.sm, alignItems: 'center', marginTop: S.sm },
});
