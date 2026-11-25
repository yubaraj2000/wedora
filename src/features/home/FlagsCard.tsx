import { StyleSheet, View } from 'react-native';

import { Card, formatINR, Pill, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import type { FlagName } from '@/lib/types';
import { useFlagValue, useWedding } from '@/lib/wedding';

const FEATURE_LABEL: Partial<Record<FlagName, string>> = {
  budget_dashboard: 'Budget dashboard',
  invite_people: 'Invite people',
  voice_expense: 'Voice expense',
  ai_task_planner: 'AI task planner',
  ceremony_suggestions: 'Ceremony ideas',
  ai_voice: 'AI voice',
};

/** "Live settings (Flagsmith)": proves flags drive the app in real time. */
export function FlagsCard() {
  const { flags, flagsSource } = useWedding();
  const limits = useFlagValue('approval_limits', { sub_head: 5000, head: 25000 });
  const voiceOn = !!flags.ai_voice?.enabled;
  const enabled = (Object.keys(FEATURE_LABEL) as FlagName[]).filter((k) => flags[k]?.enabled);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Txt variant="h3">⚙️ Live settings (Flagsmith)</Txt>
        <Pill kind={flagsSource === 'flagsmith' ? 'approved' : 'neutral'} label={flagsSource ?? '…'} />
      </View>
      <Txt variant="small">
        Approval limits: sub-head up to {formatINR(Number(limits.sub_head))}, head up to {formatINR(Number(limits.head))}
      </Txt>
      <Txt variant="small">AI voice: {voiceOn ? 'on' : 'off'}</Txt>
      <View style={styles.chips}>
        {enabled.length ? (
          enabled.map((k) => <Pill key={k} kind="level" label={FEATURE_LABEL[k]} />)
        ) : (
          <Txt variant="small" color={C.inkSoft}>
            No extra features for your level
          </Txt>
        )}
      </View>
      <Txt variant="caption" color={C.inkSoft}>
        Changes in Flagsmith appear here within ~10 s
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: S.xs, marginTop: S.xl, backgroundColor: C.cream },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginVertical: S.xs },
});
