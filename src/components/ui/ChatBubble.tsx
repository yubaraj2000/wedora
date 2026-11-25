import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { cardShadow } from './Card';
import { Txt } from './Txt';

export type ChatBubbleProps = {
  from: 'ai' | 'me';
  /** Plain text message (alternatively pass children). */
  text?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ChatBubble({ from, text, children, style }: ChatBubbleProps) {
  const isAi = from === 'ai';
  return (
    <View style={[styles.bubble, isAi ? styles.ai : styles.me, style]}>
      {isAi ? (
        <Txt variant="caption" color={C.maroon} style={styles.who}>
          🪔 Wedora
        </Txt>
      ) : null}
      {text != null ? (
        <Txt variant="body" color={isAi ? C.ink : C.white}>
          {text}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderRadius: R.lg,
    marginVertical: S.xs,
  },
  ai: {
    alignSelf: 'flex-start',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderTopLeftRadius: R.sm,
    ...cardShadow,
  },
  me: {
    alignSelf: 'flex-end',
    backgroundColor: C.maroon,
    borderTopRightRadius: R.sm,
  },
  who: { marginBottom: S.xs },
});
