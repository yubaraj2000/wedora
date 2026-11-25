import { StyleSheet, View } from 'react-native';

import { Button, Card, CheckRow, Field, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';

import type { Labels } from './labels';
import { ceremonyTitle, type CeremonyItem } from './model';

type Props = {
  items: CeremonyItem[];
  fromFlag: boolean;
  onToggle: (key: string) => void;
  custom: string;
  onCustom: (t: string) => void;
  onAdd: () => void;
  onContinue: () => void;
  busy?: boolean;
  L: Labels;
};

export function CeremonyPanel({ items, fromFlag, onToggle, custom, onCustom, onAdd, onContinue, busy, L }: Props) {
  return (
    <Card>
      <Txt variant="caption" color={C.inkSoft} style={styles.caption}>
        {fromFlag ? '🚩 Suggestions from Flagsmith (by language)' : 'Common ceremonies'}
      </Txt>
      {items.map((c) => (
        <CheckRow key={c.key} checked={c.checked} onToggle={() => onToggle(c.key)} title={ceremonyTitle(c)} note={c.note} />
      ))}
      <View style={styles.addRow}>
        <Field value={custom} onChangeText={onCustom} placeholder={L.addOwn} onSubmitEditing={onAdd} style={styles.addField} />
        <Button title={L.add} onPress={onAdd} variant="secondary" size="md" inline disabled={!custom.trim()} />
      </View>
      <Button title={L.continue} onPress={onContinue} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: { marginBottom: S.xs },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, marginTop: S.sm },
  addField: { flex: 1 },
});
