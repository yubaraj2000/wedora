import { AudioModule, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import type { Lang } from '@/lib/types';

import { stopSpeaking, transcribe, VOICE_RECORDING } from './voice';

const SPEECH_DB = -42;
const END_SILENCE_MS = 1400;
const NO_SPEECH_MS = 7000;
const MAX_MS = 20000;

type Props = {
  lang: Lang;
  /** Called with what the person said (in their own language and script). */
  onText: (text: string) => void;
  labels?: { tap?: string; listening?: string; working?: string };
};

/**
 * "Speak your answer" mic for chat steps: tap, speak, and it stops by itself when you pause
 * (or tap again). Sarvam turns the speech into text in the person's language.
 */
export function MicAnswer({ lang, onText, labels }: Props) {
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const state = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<'idle' | 'listening' | 'working'>('idle');
  const [error, setError] = useState<string | null>(null);
  const t = useRef({ startedAt: 0, speechAt: 0, lastLoudAt: 0, stopping: false });

  useEffect(() => {
    if (!state.isRecording || t.current.stopping) return;
    const now = Date.now();
    const cur = t.current;
    if (typeof state.metering === 'number' && state.metering > SPEECH_DB) {
      if (!cur.speechAt) cur.speechAt = now;
      cur.lastLoudAt = now;
    }
    if (cur.speechAt && now - cur.lastLoudAt > END_SILENCE_MS) void stop();
    else if (!cur.speechAt && now - cur.startedAt > NO_SPEECH_MS) void stop();
    else if (now - cur.startedAt > MAX_MS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.metering, state.durationMillis]);

  async function start() {
    setError(null);
    stopSpeaking();
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Please allow the microphone, or type your answer.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    t.current = { startedAt: Date.now(), speechAt: 0, lastLoudAt: 0, stopping: false };
    recorder.record();
    setPhase('listening');
  }

  async function stop() {
    if (t.current.stopping) return;
    t.current.stopping = true;
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (!recorder.uri || Date.now() - t.current.startedAt < 600) {
      setPhase('idle');
      return;
    }
    setPhase('working');
    try {
      const r = await transcribe(recorder.uri, lang);
      if (r.transcript) onText(r.transcript);
      else setError("I didn't hear anything. Please try again.");
    } catch (e) {
      setError((e as Error).message);
    }
    setPhase('idle');
  }

  const listening = phase === 'listening';
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={listening ? 'Stop and use my answer' : 'Speak your answer'}
        onPress={listening ? () => void stop() : () => void start()}
        disabled={phase === 'working'}
        style={({ pressed }) => [styles.mic, listening && styles.micOn, pressed && { opacity: 0.85 }]}
      >
        {phase === 'working' ? <ActivityIndicator color={C.white} /> : <Txt style={styles.icon}>{listening ? '■' : '🎙️'}</Txt>}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Txt variant="body" weight="700">
          {listening
            ? (labels?.listening ?? 'Listening… pause when you finish')
            : phase === 'working'
              ? (labels?.working ?? 'Understanding…')
              : (labels?.tap ?? 'Tap and speak your answer')}
        </Txt>
        {error ? (
          <Txt variant="small" color={C.danger}>
            {error}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  mic: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.marigold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: C.marigoldSoft,
  },
  micOn: { backgroundColor: C.maroon, borderColor: C.maroonSoft },
  icon: { fontSize: 26, lineHeight: 32, color: C.white },
});
