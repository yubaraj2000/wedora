import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { ChatBubble, Txt } from '@/components/ui';
import { C, R, S } from '@/constants/theme';

import { TOTAL_STEPS, type Msg } from './model';

type Props = {
  stepNum: number;
  msgs: Msg[];
  thinking?: boolean;
  thinkingLabel: string;
  /** The current step's input panel, rendered under the last bubble. */
  children?: ReactNode;
  /** Changes whenever the panel changes, to re-trigger auto-scroll. */
  scrollKey: string;
};

export function OnboardingChat({ stepNum, msgs, thinking, thinkingLabel, children, scrollKey }: Props) {
  const ref = useRef<ScrollViewInstance>(null);
  const last = msgs[msgs.length - 1];
  const lastKey = `${msgs.length}|${last?.text ?? ''}|${thinking ? 1 : 0}|${scrollKey}`;

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [lastKey]);

  return (
    <View style={styles.flex}>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(stepNum / TOTAL_STEPS) * 100}%` }]} />
        </View>
        <Txt variant="caption" color={C.inkSoft} weight="700">
          {stepNum}/{TOTAL_STEPS}
        </Txt>
      </View>
      <ScrollView
        ref={ref}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {msgs.map((m) => (
          <ChatBubble key={m.id} from={m.from} text={m.text} />
        ))}
        {thinking ? (
          <ChatBubble from="ai">
            <View style={styles.thinking}>
              <ActivityIndicator color={C.maroon} size="small" />
              <Txt variant="body" color={C.inkSoft}>
                {thinkingLabel}
              </Txt>
            </View>
          </ChatBubble>
        ) : null}
        {children ? <View style={styles.panel}>{children}</View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingBottom: S.sm },
  track: { flex: 1, height: 6, borderRadius: R.pill, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: C.maroon, borderRadius: R.pill },
  content: { paddingBottom: S.xxl },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  panel: { marginTop: S.md, gap: S.md },
});
