// Wedora theme: Pattachitra palette (Odisha folk art).
export const C = {
  marigold: '#F59E0B',
  marigoldSoft: '#FEF3C7',
  maroon: '#9F1239',
  maroonDark: '#6B0F2A',
  maroonSoft: '#FCE7EC',
  cream: '#FFF8EE',
  card: '#FFFFFF',
  leaf: '#15803D',
  successBg: '#DCFCE7',
  ink: '#2B1A12',
  inkSoft: '#6B5B4E',
  line: '#EADBC8',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  inProgress: '#3F5A7A',
  inProgressBg: '#E7EDF4',
  pendingText: '#92400E',
  white: '#FFFFFF',
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const MaxWidth = 560;

/** Type scale (system fonts only so Indic scripts render correctly). */
export const T = {
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  h2: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  h3: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypeVariant = keyof typeof T;
