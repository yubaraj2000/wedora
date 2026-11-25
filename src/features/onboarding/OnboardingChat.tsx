import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { ChatBubble, Txt } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { speakAndWait, stopSpeaking } from '@/features/voice/voice';
import type { Lang } from '@/lib/types';

import { TOTAL_STEPS, type Msg } from './model';

/**
 * Speak each new AI line aloud (Sarvam Bulbul, in the chosen language), one after another.
 * Lines still being translated ("…") wait until their text arrives.
 */
function useSpeakLines(msgs: Msg[], lang: Lang | null | undefined, on: boolean) {
  const spoken = useRef(new Set<number>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const started = useRef(false);
  useEffect(() => {
    if (!lang) return;
    if (!started.current) {
      // Don't read out the old lines (the language question), but DO speak the newest AI question.
      const lastAi = [...msgs].reverse().find((m) => m.from === 'ai');
      msgs.forEach((m) => m.id !== lastAi?.id && spoken.current.add(m.id));
      started.current = true;
    }
    for (const m of msgs) {
      if (m.from !== 'ai' || spoken.current.has(m.id) || !m.text || m.text === '…') continue;
      spoken.current.add(m.id);
      if (!on) continue;
      const text = m.text.split('\n(')[0]; // drop technical error details
      queue.current = queue.current.then(() => speakAndWait(text, lang));
    }
  }, [msgs, lang, on]);
  useEffect(() => () => stopSpeaking(), []);
}

type Props = {
  stepNum: number;
  msgs: Msg[];
  thinking?: boolean;
  thinkingLabel: string;
  /** The current step's input panel, rendered under the last bubble. */
  children?: ReactNode;
  /** Changes whenever the panel changes, to re-trigger auto-scroll. */
  scrollKey: string;
  /** When set, AI lines are spoken aloud in this language. */
  voiceLang?: Lang | null;
};

export function OnboardingChat({ stepNum, msgs, thinking, thinkingLabel, children, scrollKey, voiceLang }: Props) {
  const ref = useRef<ScrollViewInstance>(null);
  const [soundOn, setSoundOn] = useState(true);
  useSpeakLines(msgs, voiceLang, soundOn);
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
        {voiceLang ? (
          <Pressable
            accessibilityLabel={soundOn ? 'Mute Wedora' : 'Let Wedora speak'}
            onPress={() => {
              if (soundOn) stopSpeaking();
              setSoundOn(!soundOn);
            }}
            hitSlop={12}
          >
            <Txt variant="h3">{soundOn ? '🔊' : '🔇'}</Txt>
          </Pressable>
        ) : null}
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
