import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

export type CardProps = {
  children?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({ children, onPress, style, accessibilityLabel }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export const cardShadow: ViewStyle =
  Platform.select<ViewStyle>({
    android: { elevation: 1 },
    default: { boxShadow: '0px 1px 3px rgba(43, 26, 18, 0.08)' },
  }) ?? {};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.lg,
    ...cardShadow,
  },
  pressed: { opacity: 0.85 },
});
