import type { Ceremony, SuggestedTask } from '@/lib/types';

export type Step = 'lang' | 'about' | 'confirm' | 'budget' | 'budgetConfirm' | 'ceremonies' | 'tasks' | 'heads' | 'invites';

export const TOTAL_STEPS = 7;
export const STEP_NUM: Record<Step, number> = {
  lang: 1,
  about: 2,
  confirm: 2,
  budget: 3,
  budgetConfirm: 3,
  ceremonies: 4,
  tasks: 5,
  heads: 6,
  invites: 7,
};

export type Msg = { id: number; from: 'ai' | 'me'; text: string };

export type WeddingDraft = { bride: string; groom: string; date: string; city: string; adminName: string };
export const EMPTY_DRAFT: WeddingDraft = { bride: '', groom: '', date: '', city: '', adminName: '' };

export type CeremonyItem = Ceremony & { checked: boolean; custom?: boolean };
export type TaskItem = SuggestedTask & { id: string; checked: boolean };
export type HeadDraft = { name: string; phone: string; skip: boolean };
export type SentInvite = { deptId: string; dept: string; name: string; phone: string; token: string; sent: boolean };

export const FALLBACK_CEREMONIES: Ceremony[] = [
  { key: 'engagement', en: 'Engagement', local: 'Engagement' },
  { key: 'haldi', en: 'Haldi', local: 'Haldi' },
  { key: 'mehendi', en: 'Mehendi', local: 'Mehendi' },
  { key: 'sangeet', en: 'Sangeet', local: 'Sangeet' },
  { key: 'wedding', en: 'Wedding ceremony', local: 'Wedding ceremony' },
  { key: 'reception', en: 'Reception', local: 'Reception' },
];

/** Flag values may arrive as an array or as a JSON string; keep only well-formed entries. */
export function parseCeremonies(v: unknown): Ceremony[] {
  let arr: unknown = v;
  if (typeof v === 'string') {
    try {
      arr = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c): c is Ceremony => !!c && typeof c === 'object' && typeof (c as Ceremony).key === 'string' && typeof (c as Ceremony).en === 'string')
    .map((c) => ({ key: c.key, en: c.en, local: c.local || c.en, note: c.note }));
}

export function slug(s: string): string {
  const out = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return out || `custom_${Date.now().toString(36)}`;
}

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

export const ceremonyTitle = (c: { en: string; local: string }) =>
  c.local && c.local !== c.en ? `${c.local} · ${c.en}` : c.en;

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
