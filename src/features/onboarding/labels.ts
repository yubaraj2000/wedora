import { useMemo } from 'react';

import type { Lang } from '@/lib/types';
import { useSay } from '@/lib/say';

const EN = {
  send: 'Send',
  looksRight: 'Looks right',
  yes: 'Yes',
  change: 'Change',
  continue: 'Continue',
  add: 'Add',
  skip: 'Skip',
  skipForNow: 'Skip for now',
  pickContact: 'Pick contact',
  sendWA: 'Send on WhatsApp',
  sent: 'Sent',
  goDashboard: 'Go to dashboard',
  bride: 'Bride',
  groom: 'Groom',
  date: 'Date (YYYY-MM-DD)',
  city: 'City',
  yourName: 'Your name',
  name: 'Name',
  phone: 'Phone',
  addOwn: 'Add your own',
  thinking: 'Thinking…',
  retry: 'Try again',
  noHeads: 'No invites yet.',
  micTap: 'Tap and speak your answer',
  micListening: 'Listening… pause when you finish',
};

export type Labels = typeof EN;
const KEYS = Object.keys(EN) as (keyof Labels)[];
const VALUES = KEYS.map((k) => EN[k]);

/** UI labels in the chosen language (English first, translated when Sarvam replies). */
export function useLabels(lang: Lang): Labels {
  const out = useSay(lang, VALUES);
  return useMemo(() => {
    const l = {} as Labels;
    KEYS.forEach((k, i) => (l[k] = out[i] ?? EN[k]));
    return l;
  }, [out]);
}
