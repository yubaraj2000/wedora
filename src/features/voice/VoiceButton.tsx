import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useFlag } from '@/lib/wedding';

/**
 * Big "tap and speak" mic. Placeholder: the lead builds the real Sarvam voice flow here (Layer 2).
 * Shown only when Flagsmith turns on voice_expense for this member's level (and ai_voice is on).
 */
export function VoiceButton() {
  const on = useFlag('voice_expense');
  if (!on) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.mic}>
        <Txt variant="title" color={C.white}>
          🎙️
        </Txt>
      </View>
      <Txt variant="h3">Tap and speak</Txt>
      <Txt variant="small" color={C.inkSoft}>
        ଓଡ଼ିଆ · हिन्दी · বাংলা · English (coming in a moment)
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: S.sm, paddingVertical: S.lg },
  mic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.marigold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
