import { createAudioPlayer, IOSOutputFormat, AudioQuality, type RecordingOptions } from 'expo-audio';
import { File as FSFile } from 'expo-file-system';
import { Platform } from 'react-native';

import { fn } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Lang } from '@/lib/types';

/** 16 kHz mono, small files: fast upload on venue Wi-Fi (lesson from Basket). */
export const VOICE_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};

export type VoiceAction =
  | { intent: 'expense'; amount: number; description: string; paid_to: string; amount_source: 'parser' | 'ai' }
  | { intent: 'task'; title: string; department_id: string | null; department: string }
  | { intent: 'task_status'; task_id: string; title: string; from: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked' }
  | { intent: 'ask_status' }
  | { intent: 'confirm' }
  | { intent: 'cancel' }
  | { intent: 'stop' }
  | { intent: 'none' };

export type Turn = { role: 'me' | 'ai'; text: string };

export type VoiceResult = {
  transcript: string;
  language: Lang;
  action: VoiceAction;
  reply: string;
  reply_en?: string;
  ms?: { stt?: number; llm?: number; total?: number };
};

/**
 * Attach a recording to a multipart form.
 * Web: fetch the blob. Phones: Expo's fetch (SDK 58) rejects React Native's old {uri, name, type} parts
 * ("Unsupported FormDataPart implementation"), so pass expo-file-system's File, which implements Blob.
 */
async function appendRecording(form: FormData, uri: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', new File([blob], 'speech.webm', { type: blob.type || 'audio/webm' }));
  } else {
    form.append('file', new FSFile(uri) as unknown as Blob, 'speech.m4a');
  }
}

/** Send a recording to the wedora function: Sarvam speech-to-text → sarvam-105b → proposed action. */
export async function understand(
  uri: string,
  weddingId: string,
  lang: Lang | 'auto',
  convo: { pending?: VoiceAction | null; history?: Turn[] } = {},
): Promise<VoiceResult> {
  const form = new FormData();
  form.append('wedding_id', weddingId);
  form.append('lang', lang);
  if (convo.pending) form.append('pending', JSON.stringify(convo.pending));
  if (convo.history?.length) form.append('history', JSON.stringify(convo.history.slice(-6)));
  await appendRecording(form, uri);
  const { data } = await supabase.auth.getSession();
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wedora`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `voice failed (${res.status})`);
  return body as VoiceResult;
}

let player: ReturnType<typeof createAudioPlayer> | null = null;

/** Stop anything Wedora is saying right now. */
export function stopSpeaking() {
  try {
    player?.pause();
    player?.remove();
  } catch {
    /* already gone */
  }
  player = null;
}

/**
 * Speak a line aloud (Sarvam Bulbul) and resolve when it has finished playing, so the conversation
 * only starts listening again after Wedora stops talking (no echo). Never throws.
 */
export async function speakAndWait(text: string, lang: Lang, weddingId?: string | null): Promise<void> {
  if (!text.trim()) return;
  try {
    const { audio_b64, mime } = await fn<{ audio_b64: string; mime: string }>('speak', {
      text,
      lang,
      ...(weddingId ? { wedding_id: weddingId } : {}),
    });
    if (!audio_b64) return;
    stopSpeaking();
    const p = createAudioPlayer({ uri: `data:${mime};base64,${audio_b64}` });
    player = p;
    await new Promise<void>((resolve) => {
      // WAV size → seconds (16-bit mono); cap the wait in case the finish event never comes.
      const approxSec = (audio_b64.length * 0.75) / 2 / 22050;
      const fallback = setTimeout(done, Math.min(20, approxSec + 2) * 1000);
      const sub = p.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) done();
      });
      function done() {
        clearTimeout(fallback);
        sub.remove();
        resolve();
      }
      p.play();
    });
  } catch (e) {
    console.warn('speak failed', (e as Error).message);
  }
}

/** Speech → text only (onboarding answers, before the wedding exists). */
export async function transcribe(uri: string, lang: Lang | 'auto'): Promise<{ transcript: string; language: Lang }> {
  const form = new FormData();
  form.append('op', 'transcribe');
  form.append('lang', lang);
  await appendRecording(form, uri);
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wedora`, {
    method: 'POST',
    headers: {
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `transcribe failed (${res.status})`);
  return body;
}

/** Fire-and-forget version for one-off replies. */
export function speakAloud(text: string, lang: Lang, weddingId: string) {
  void speakAndWait(text, lang, weddingId);
}

/** Wake the server function when the voice card opens (cold starts made the first command slow). */
export function warmUpVoice() {
  fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wedora?op=health`).catch(() => undefined);
}
