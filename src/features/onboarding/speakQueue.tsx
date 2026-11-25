import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';

import { Txt } from '@/components/ui';
import { speakAndWait, stopSpeaking } from '@/features/voice/voice';
import type { Lang } from '@/lib/types';

/** One AI line on screen. `ready` = its final (translated) text has arrived. */
export type SpeakLine = { key: string; text: string; ready: boolean };

type QState = {
  spoken: Set<string>; // already spoken, or dropped while muted
  queued: Set<string>; // waiting in the current chain
  chain: Promise<void>;
  gen: number; // bumped on mute / unmount: older queued items are skipped
  inflight: number | null; // gen of the line being fetched/played right now
};

/** Drop the queue and silence Wedora (also catches a line whose audio is still downloading). */
function cancel(s: QState, drop: boolean) {
  const old = s.gen;
  s.gen += 1;
  s.chain = Promise.resolve();
  if (drop) s.queued.forEach((k) => s.spoken.add(k));
  s.queued.clear();
  stopSpeaking();
  if (s.inflight === old) {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (s.inflight !== old || Date.now() - t0 > 5000) clearInterval(iv);
      else stopSpeaking();
    }, 250);
  }
}

/**
 * Speak each AI line aloud once, in order, one voice at a time — whether the person types or talks.
 * A line still being translated holds back the lines after it, so the order never jumbles.
 * `lang` null = voice off for this screen.
 */
export function useSpeakQueue(lines: SpeakLine[], lang: Lang | null | undefined, weddingId?: string | null) {
  const [soundOn, setSoundOn] = useState(true);
  const q = useRef<QState>({ spoken: new Set(), queued: new Set(), chain: Promise.resolve(), gen: 0, inflight: null });

  useEffect(() => {
    const s = q.current;
    if (!lang) return;
    if (!soundOn) {
      // Muted: lines that appear now are not read out later.
      for (const l of lines) if (l.ready) s.spoken.add(l.key);
      return;
    }
    for (const l of lines) {
      if (s.spoken.has(l.key) || s.queued.has(l.key)) continue;
      if (!l.ready) break; // wait for its translation; keep the order
      const text = l.text.split('\n(')[0].trim(); // drop technical error details
      if (!text || text === '…') {
        s.spoken.add(l.key);
        continue;
      }
      s.queued.add(l.key);
      const my = s.gen;
      s.chain = s.chain.then(async () => {
        if (my !== s.gen) return;
        s.queued.delete(l.key);
        s.spoken.add(l.key);
        s.inflight = my;
        try {
          await speakAndWait(text, lang, weddingId);
        } finally {
          if (s.inflight === my) s.inflight = null;
        }
      });
    }
  }, [lines, lang, soundOn, weddingId]);

  // Leaving the screen: stop talking. Unspoken lines stay eligible (StrictMode remounts re-queue them).
  useEffect(() => {
    const s = q.current;
    return () => cancel(s, false);
  }, []);

  const toggleSound = () => {
    if (soundOn) cancel(q.current, true);
    setSoundOn(!soundOn);
  };

  return { soundOn, toggleSound };
}

/** 🔊 / 🔇 button: mute stops Wedora at once and keeps her quiet until unmuted. */
export function SpeakToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityLabel={on ? 'Mute Wedora' : 'Let Wedora speak'} onPress={onToggle} hitSlop={12}>
      <Txt variant="h3">{on ? '🔊' : '🔇'}</Txt>
    </Pressable>
  );
}
