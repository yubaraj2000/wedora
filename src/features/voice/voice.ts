import { createAudioPlayer, IOSOutputFormat, AudioQuality, type RecordingOptions } from 'expo-audio';
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
  | { intent: 'none' };

export type VoiceResult = {
  transcript: string;
  language: Lang;
  action: VoiceAction;
  reply: string;
  reply_en?: string;
  ms?: { stt?: number; llm?: number; total?: number };
};

/** Send a recording to the wedora function: Sarvam speech-to-text → sarvam-105b → proposed action. */
export async function understand(uri: string, weddingId: string, lang: Lang | 'auto'): Promise<VoiceResult> {
  const form = new FormData();
  form.append('wedding_id', weddingId);
  form.append('lang', lang);
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', new File([blob], 'speech.webm', { type: blob.type || 'audio/webm' }));
  } else {
    // React Native FormData file part
    form.append('file', { uri, name: 'speech.m4a', type: 'audio/mp4' } as unknown as Blob);
  }
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

/** Speak a line aloud in the given language (Sarvam Bulbul). Fire-and-forget. */
export async function speakAloud(text: string, lang: Lang) {
  try {
    const { audio_b64, mime } = await fn<{ audio_b64: string; mime: string }>('speak', { text, lang });
    if (!audio_b64) return;
    player?.remove();
    player = createAudioPlayer({ uri: `data:${mime};base64,${audio_b64}` });
    player.play();
  } catch (e) {
    console.warn('speak failed', (e as Error).message);
  }
}
