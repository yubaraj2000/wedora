import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Txt } from './Txt';

export type CheckRowProps = {
  checked: boolean;
  onToggle: () => void;
  title: string;
  note?: string;
  style?: StyleProp<ViewStyle>;
};

export function CheckRow({ checked, onToggle, title, note, style }: CheckRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={note ? `${title}. ${note}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}>
      <View style={[styles.box, checked ? styles.boxOn : styles.boxOff]}>
        {checked ? (
          <Txt variant="h3" color={C.white} style={styles.tick}>
            ✓
          </Txt>
        ) : null}
      </View>
      <View style={styles.text}>
        <Txt variant="body" weight="600">
          {title}
        </Txt>
        {note ? (
          <Txt variant="small" color={C.inkSoft}>
            {note}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: 56,
    paddingVertical: S.sm,
  },
  pressed: { opacity: 0.7 },
  box: {
    width: 28,
    height: 28,
    borderRadius: R.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: C.maroon, borderColor: C.maroon },
  boxOff: { backgroundColor: C.card, borderColor: C.inkSoft },
  tick: { lineHeight: 22 },
  text: { flex: 1 },
});
