import { StyleSheet, View } from 'react-native';

import { Button, Card, Field } from '@/components/ui';
import { S } from '@/constants/theme';

import type { Labels } from './labels';
import { isDate, type WeddingDraft } from './model';

type Props = {
  draft: WeddingDraft;
  onChange: (d: WeddingDraft) => void;
  onConfirm: () => void;
  busy?: boolean;
  L: Labels;
};

export function ConfirmWeddingCard({ draft, onChange, onConfirm, busy, L }: Props) {
  const set = (k: keyof WeddingDraft) => (v: string) => onChange({ ...draft, [k]: v });
  const badDate = !!draft.date.trim() && !isDate(draft.date);
  return (
    <Card>
      <View style={styles.row}>
        <Field label={L.bride} value={draft.bride} onChangeText={set('bride')} autoCapitalize="words" style={styles.half} />
        <Field label={L.groom} value={draft.groom} onChangeText={set('groom')} autoCapitalize="words" style={styles.half} />
      </View>
      <Field
        label={L.date}
        value={draft.date}
        onChangeText={set('date')}
        placeholder="2026-12-12"
        error={badDate ? 'YYYY-MM-DD' : null}
      />
      <Field label={L.city} value={draft.city} onChangeText={set('city')} autoCapitalize="words" />
      <Field label={L.yourName} value={draft.adminName} onChangeText={set('adminName')} autoCapitalize="words" />
      <Button title={L.looksRight} icon="✓" onPress={onConfirm} loading={busy} disabled={badDate} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.sm },
  half: { flex: 1 },
});
