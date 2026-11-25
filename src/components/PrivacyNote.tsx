import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useSay } from '@/lib/say';
import type { Lang } from '@/lib/types';

const LINES = [
  'Your privacy',
  'Wedora keeps your name, language, and this wedding’s tasks and expenses so your family can plan together.',
  'When you speak, your voice goes to Sarvam AI (India) to be understood. It is not stored.',
  'Phone numbers are used only to send invite links.',
  'If you are under 18, please ask a parent or guardian before joining.',
  'You can leave the wedding at any time from your Home screen.',
];

/** Short notice shown before anyone shares personal data (DPDP Act basics), in the person's language. */
export function PrivacyNote({ lang }: { lang?: Lang | null }) {
  const [title, ...rest] = useSay(lang, LINES);
  return (
    <View style={styles.box} accessibilityRole="summary">
      <Txt variant="caption" weight="700" color={C.inkSoft}>
        🔒 {title}
      </Txt>
      {rest.map((l) => (
        <Txt key={l} variant="caption" color={C.inkSoft}>
          • {l}
        </Txt>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.cream, borderColor: C.line, borderWidth: 1, borderRadius: R.md, padding: S.md, gap: 2 },
});
