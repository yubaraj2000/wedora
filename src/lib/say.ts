import { useEffect, useState } from 'react';

import { say } from './api';
import type { Lang } from './types';

const cache = new Map<string, string>();
const k = (lang: Lang, t: string) => `${lang}|${t}`;

/**
 * Show English lines in the user's language (Sarvam translate via the wedora function).
 * Returns the English text first, then swaps in translations when they arrive. Cached per session.
 */
export function useSay(lang: Lang | null | undefined, lines: string[]): string[] {
  const l: Lang = lang ?? 'en-IN';
  const joined = lines.join('\u0001');
  const [out, setOut] = useState<string[]>(() => lines.map((t) => cache.get(k(l, t)) ?? t));

  useEffect(() => {
    const src = joined.split('\u0001');
    if (l === 'en-IN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOut(src);
      return;
    }
    const missing = src.filter((t) => t && !cache.has(k(l, t)));
    setOut(src.map((t) => cache.get(k(l, t)) ?? t));
    if (!missing.length) return;
    let alive = true;
    say(l, missing)
      .then((tr) => {
        missing.forEach((t, i) => cache.set(k(l, t), tr[i] ?? t));
        if (alive) setOut(src.map((t) => cache.get(k(l, t)) ?? t));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [l, joined]);

  return out;
}

/** One-off translation (for AI chat lines built at runtime). */
export async function sayNow(lang: Lang, text: string): Promise<string> {
  if (lang === 'en-IN' || !text) return text;
  const hit = cache.get(k(lang, text));
  if (hit) return hit;
  try {
    const [t] = await say(lang, [text]);
    cache.set(k(lang, text), t);
    return t;
  } catch {
    return text;
  }
}
