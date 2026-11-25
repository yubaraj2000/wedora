import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Txt } from './Txt';

export type PillKind =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'
  | 'approved'
  | 'rejected'
  | 'level'
  | 'neutral';

export const PILL_STYLES: Record<PillKind, { bg: string; fg: string; label: string }> = {
  pending: { bg: C.marigoldSoft, fg: C.pendingText, label: 'Pending' },
  in_progress: { bg: C.inProgressBg, fg: C.inProgress, label: 'In progress' },
  completed: { bg: C.successBg, fg: C.leaf, label: 'Done' },
  blocked: { bg: C.dangerBg, fg: C.danger, label: 'Blocked' },
  cancelled: { bg: C.line, fg: C.inkSoft, label: 'Cancelled' },
  approved: { bg: C.successBg, fg: C.leaf, label: 'Approved' },
  rejected: { bg: C.dangerBg, fg: C.danger, label: 'Rejected' },
  level: { bg: C.maroonSoft, fg: C.maroon, label: 'Level' },
  neutral: { bg: C.cream, fg: C.inkSoft, label: '' },
};

export type PillProps = {
  kind: PillKind;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ kind, label, style }: PillProps) {
  const p = PILL_STYLES[kind];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }, kind === 'neutral' && styles.neutral, style]}>
      <Txt variant="caption" color={p.fg} weight="700" numberOfLines={1}>
        {label ?? p.label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 2,
    borderRadius: R.pill,
  },
  neutral: { borderWidth: 1, borderColor: C.line },
});
