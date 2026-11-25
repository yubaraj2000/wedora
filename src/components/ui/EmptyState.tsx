import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';

import { C, S } from '@/constants/theme';

import { Txt } from './Txt';

export const EMPTY_IMAGES = {
  tasks: require('../../../assets/images/theme/empty-tasks.png') as number,
  expenses: require('../../../assets/images/theme/empty-expenses.png') as number,
  waiting: require('../../../assets/images/theme/empty-waiting.png') as number,
} as const;

export type EmptyStateProps = {
  source?: ImageSource | number;
  title: string;
  body?: string;
  /** Optional action (e.g. a Button) shown below the text. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ source, title, body, children, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      {source != null ? (
        <Image source={source} style={styles.image} contentFit="contain" accessible={false} />
      ) : null}
      <Txt variant="h3" center>
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" color={C.inkSoft} center>
          {body}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.xl },
  image: { width: 160, height: 160, marginBottom: S.sm },
});
