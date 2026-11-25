import { StyleSheet, View } from 'react-native';

import { Button, Card, CheckRow, Field, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { canPickContacts } from '@/lib/invite';
import type { Department } from '@/lib/types';

import type { Labels } from './labels';
import type { HeadDraft } from './model';

type Props = {
  departments: Department[];
  headOf: (id: string) => HeadDraft;
  setHead: (id: string, patch: Partial<HeadDraft>) => void;
  onPick: (id: string) => void;
  onContinue: () => void;
  busy?: boolean;
  L: Labels;
};

export function HeadsPanel({ departments, headOf, setHead, onPick, onContinue, busy, L }: Props) {
  return (
    <>
      {departments.map((d) => {
        const h = headOf(d.id);
        return (
          <Card key={d.id}>
            <Txt variant="h3" color={C.maroon} style={styles.title}>
              {d.name}
            </Txt>
            {!h.skip ? (
              <View>
                {canPickContacts ? (
                  <Button title={L.pickContact} icon="📇" onPress={() => onPick(d.id)} variant="secondary" size="sm" inline style={styles.pick} />
                ) : null}
                <Field label={L.name} value={h.name} onChangeText={(name) => setHead(d.id, { name })} autoCapitalize="words" />
                <Field label={L.phone} value={h.phone} onChangeText={(phone) => setHead(d.id, { phone })} keyboardType="phone-pad" placeholder="98765 43210" />
              </View>
            ) : null}
            <CheckRow checked={h.skip} onToggle={() => setHead(d.id, { skip: !h.skip })} title={L.skipForNow} />
          </Card>
        );
      })}
      <Button title={L.continue} onPress={onContinue} loading={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: S.sm },
  pick: { marginBottom: S.md },
});
