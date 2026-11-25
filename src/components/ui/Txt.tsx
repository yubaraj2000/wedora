import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { C, T, type TypeVariant } from '@/constants/theme';

export type TxtVariant = TypeVariant;

export type TxtProps = TextProps & {
  variant?: TxtVariant;
  color?: string;
  center?: boolean;
  weight?: TextStyle['fontWeight'];
};

export function Txt({ variant = 'body', color = C.ink, center, weight, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        styles[variant],
        { color },
        center && styles.center,
        weight !== undefined && { fontWeight: weight },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ...T,
  center: { textAlign: 'center' },
});
