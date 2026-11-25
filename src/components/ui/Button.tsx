import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { Txt } from './Txt';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading emoji. */
  icon?: string;
  /** Shrink to content instead of full width. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.maroon, fg: C.white, border: C.maroon },
  secondary: { bg: C.card, fg: C.maroon, border: C.maroon },
  success: { bg: C.leaf, fg: C.white, border: C.leaf },
  danger: { bg: C.danger, fg: C.white, border: C.danger },
  ghost: { bg: 'transparent', fg: C.maroon, border: 'transparent' },
};

const HEIGHT: Record<ButtonSize, number> = { lg: 56, md: 48, sm: 40 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  icon,
  inline,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const p = PALETTE[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: HEIGHT[size],
          backgroundColor: p.bg,
          borderColor: p.border,
          paddingHorizontal: size === 'sm' ? S.md : S.xl,
        },
        inline ? styles.inline : styles.full,
        disabled && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Txt variant={size === 'sm' ? 'body' : 'h3'} style={styles.icon}>
              {icon}
            </Txt>
          ) : null}
          <Txt variant={size === 'sm' ? 'small' : 'h3'} color={p.fg} weight="700" numberOfLines={2} center>
            {title}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: R.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  icon: { lineHeight: undefined },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
