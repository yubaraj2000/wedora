import { useCallback } from 'react';

import { useSay } from '@/lib/say';
import type { Lang } from '@/lib/types';

export type T = (en: string) => string;

/** Translate a fixed set of English lines; returns t(en) → localized (falls back to English). */
export function useT(lang: Lang | null | undefined, lines: string[]): T {
  const out = useSay(lang, lines);
  // Stable key for lines array — avoids a non-simple expression inside the dep array.
  const linesKey = lines.join('\u0001');
  return useCallback(
    (en: string) => {
      const i = lines.indexOf(en);
      return i >= 0 ? (out[i] ?? en) : en;
    },
    // lines are rebuilt every render; out changes whenever translations land
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [out, linesKey],
  );
}
