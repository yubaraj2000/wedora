import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Txt } from './Txt';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  sublabel?: string;
  /** Larger label text (used by LanguagePicker). */
  big?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected, onPress, sublabel, big, style }: ChipProps) {
  const fg = selected ? C.white : C.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        big && styles.big,
        pressed && styles.pressed,
        style,
      ]}>
      <Txt variant={big ? 'h2' : 'body'} color={fg} weight={big ? '700' : '600'} center>
        {label}
      </Txt>
      {sublabel ? (
        <Txt variant="small" color={selected ? C.white : C.inkSoft} center>
          {sublabel}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    borderRadius: R.pill,
    borderWidth: 1.5,
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { minHeight: 80, borderRadius: R.lg, paddingVertical: S.md },
  selected: { backgroundColor: C.maroon, borderColor: C.maroon },
  unselected: { backgroundColor: C.card, borderColor: C.line },
  pressed: { opacity: 0.8 },
});
