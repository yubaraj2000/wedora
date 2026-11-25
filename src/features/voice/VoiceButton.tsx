import { AudioModule, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ChatBubble, Chip, Txt, formatINR } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { createTask, getMembers, submitExpense } from '@/lib/api';
import { sayNow } from '@/lib/say';
import type { Lang } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { useFlag, useWedding } from '@/lib/wedding';

import { speakAloud, understand, VOICE_RECORDING, type VoiceResult } from './voice';

const MAX_SECONDS = 15;
const SPEECH_DB = -45; // loudest moment below this = nobody spoke
const MIN_MS = 600;
const HINTS: { code: Lang | 'auto'; label: string }[] = [
  { code: 'auto', label: 'Auto' },
  { code: 'od-IN', label: 'ଓଡ଼ିଆ' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'en-IN', label: 'English' },
];

type Phase = 'idle' | 'listening' | 'thinking' | 'confirm' | 'saving' | 'done' | 'error';

/**
 * Tap and speak in Odia / Hindi / Bengali / English. Sarvam hears it, sarvam-105b proposes ONE action,
 * the person confirms, and the same permission-checked server path as the buttons saves it.
 * Visible only when Flagsmith turns on voice_expense for this member's level (and the ai_voice kill switch is on).
 */
export function VoiceButton() {
  const on = useFlag('voice_expense');
  const { member, wedding } = useWedding();
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const state = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<Phase>('idle');
  const [hint, setHint] = useState<Lang | 'auto'>(member?.language ?? 'auto');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const peak = useRef(-160);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.isRecording && typeof state.metering === 'number') peak.current = Math.max(peak.current, state.metering);
  }, [state.isRecording, state.metering]);

  if (!on || !member || !wedding) return null;
  const lang: Lang = result?.language ?? (hint === 'auto' ? member.language : hint);

  async function start() {
    setResult(null);
    setMessage(null);
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setPhase('error');
      setMessage('Please allow the microphone to talk to Wedora.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    peak.current = -160;
    startedAt.current = Date.now();
    recorder.record();
    setPhase('listening');
    timer.current = setTimeout(stop, MAX_SECONDS * 1000);
  }

  async function stop() {
    if (timer.current) clearTimeout(timer.current);
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const tooShort = Date.now() - startedAt.current < MIN_MS;
    const silent = peak.current > -160 && peak.current < SPEECH_DB;
    if (tooShort || silent || !recorder.uri) {
      setPhase('error');
      setMessage(await sayNow(lang, "I didn't hear anything. Hold the phone close and try again."));
      return;
    }
    setPhase('thinking');
    try {
      const r = await understand(recorder.uri, wedding!.id, hint);
      setResult(r);
      setPhase(r.action.intent === 'none' ? 'done' : 'confirm');
      speakAloud(r.reply, r.language);
    } catch (e) {
      setPhase('error');
      setMessage((e as Error).message);
    }
  }

  async function confirm() {
    if (!result || !wedding || !member) return;
    setPhase('saving');
    try {
      const a = result.action;
      let doneEn = '';
      if (a.intent === 'expense') {
        const r = await submitExpense(wedding.id, { amount: a.amount, description: a.description, paid_to: a.paid_to, source: 'voice' });
        const members = await getMembers(wedding.id);
        const appr = members.find((x) => x.id === r.expense.approver_id);
        const why =
          r.expense.approval_level === 'sub_head'
            ? `up to ₹${r.limits.sub_head}`
            : r.expense.approval_level === 'head'
              ? `above ₹${r.limits.sub_head}`
              : `above ₹${r.limits.head}`;
        doneEn = `Saved. ${formatINR(a.amount)} sent to ${appr?.display_name ?? 'the approver'} (${ROLE_LABEL[appr?.role ?? 'admin']}) for approval, because it is ${why}.`;
      } else if (a.intent === 'task') {
        await createTask(a.department_id ?? member.department_id ?? '', a.title, null, 'voice');
        doneEn = `Task added for ${a.department}: ${a.title}.`;
      }
      const local = await sayNow(lang, doneEn);
      setMessage(local);
      setPhase('done');
      speakAloud(local, lang);
    } catch (e) {
      setPhase('error');
      setMessage((e as Error).message);
    }
  }

  const listening = phase === 'listening';
  const busy = phase === 'thinking' || phase === 'saving';

  return (
    <Card style={styles.card}>
      <View style={styles.hints}>
        {HINTS.map((h) => (
          <Chip key={h.code} label={h.label} selected={hint === h.code} onPress={() => setHint(h.code)} />
        ))}
      </View>

      <Pressable
        accessibilityLabel={listening ? 'Stop recording' : 'Tap and speak'}
        onPress={listening ? stop : start}
        disabled={busy}
        style={({ pressed }) => [styles.mic, listening && styles.micOn, pressed && { opacity: 0.85 }]}
      >
        {busy ? <ActivityIndicator color={C.white} size="large" /> : <Txt style={styles.micIcon}>{listening ? '■' : '🎙️'}</Txt>}
      </Pressable>
      <Txt variant="h3" center>
        {listening ? 'Listening… tap to stop' : phase === 'thinking' ? 'Understanding…' : 'Tap and speak'}
      </Txt>
      <Txt variant="small" color={C.inkSoft} center>
        e.g. “ମାମୁ ଟେଣ୍ଟ ୱାଲାକୁ ୧୨ ହଜାର ଦେଲେ” · “Mamu paid 12,000 to the tent-wala”
      </Txt>

      {result?.transcript ? <ChatBubble from="me" text={result.transcript} /> : null}
      {result?.reply ? <ChatBubble from="ai" text={result.reply} /> : null}

      {phase === 'confirm' && result?.action.intent === 'expense' ? (
        <Card style={styles.action}>
          <Txt variant="caption" color={C.inkSoft}>
            EXPENSE · {member.department_id ? 'your department' : 'Finance'}
          </Txt>
          <Txt variant="title">{formatINR(result.action.amount)}</Txt>
          <Txt variant="body">
            {result.action.description}
            {result.action.paid_to ? ` · paid to ${result.action.paid_to}` : ''}
          </Txt>
          <View style={styles.row}>
            <Button title="Confirm" variant="success" inline onPress={confirm} />
            <Button title="Cancel" variant="secondary" inline onPress={() => setPhase('idle')} />
          </View>
        </Card>
      ) : null}

      {phase === 'confirm' && result?.action.intent === 'task' ? (
        <Card style={styles.action}>
          <Txt variant="caption" color={C.inkSoft}>
            TASK · {result.action.department}
          </Txt>
          <Txt variant="h3">{result.action.title}</Txt>
          <View style={styles.row}>
            <Button title="Confirm" variant="success" inline onPress={confirm} />
            <Button title="Cancel" variant="secondary" inline onPress={() => setPhase('idle')} />
          </View>
        </Card>
      ) : null}

      {message ? (
        <Txt variant="body" color={phase === 'error' ? C.danger : C.leaf} center>
          {message}
        </Txt>
      ) : null}
      {result?.ms?.total ? (
        <Txt variant="caption" color={C.inkSoft} center>
          Sarvam: heard in {((result.ms.stt ?? 0) / 1000).toFixed(1)} s · understood in {((result.ms.llm ?? 0) / 1000).toFixed(1)} s
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
  micIcon: { fontSize: 44, lineHeight: 52 },
  action: { gap: S.sm, borderColor: C.marigold, borderWidth: 2 },
  row: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
});
