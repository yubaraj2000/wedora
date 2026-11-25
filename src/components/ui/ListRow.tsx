import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, S } from '@/constants/theme';

import { Txt } from './Txt';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Optional leading element (emoji string or node). */
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  /** Show bottom divider. Default true. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ title, subtitle, left, right, onPress, divider = true, style }: ListRowProps) {
  const content = (
    <>
      {left != null ? (
        typeof left === 'string' ? <Txt variant="h2">{left}</Txt> : left
      ) : null}
      <View style={styles.text}>
        <Txt variant="body" weight="600" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" color={C.inkSoft} numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right != null ? (
        typeof right === 'string' ? <Txt variant="body" weight="700">{right}</Txt> : right
      ) : onPress ? (
        <Txt variant="h2" color={C.inkSoft}>
          ›
        </Txt>
      ) : null}
    </>
  );
  const rowStyle = [styles.row, divider && styles.divider, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: 60,
    paddingVertical: S.md,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  text: { flex: 1 },
  pressed: { opacity: 0.7 },
});
