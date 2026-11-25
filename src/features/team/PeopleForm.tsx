import { StyleSheet, View } from 'react-native';

import { Button, Card, CheckRow, Field, SectionHeader, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { canPickContacts, pickContact } from '@/lib/invite';

import type { T } from './useT';

export type PersonRow = { name: string; phone: string; token?: string };
export type SubHeadRow = PersonRow & { team: string; deptId?: string };

export const emptyPerson = (): PersonRow => ({ name: '', phone: '' });
export const emptySubHead = (): SubHeadRow => ({ team: '', name: '', phone: '' });
export const filled = (r: PersonRow) => !!(r.name.trim() || r.phone.trim());

export const PEOPLE_LINES = [
  'Sub-heads',
  'Optional. A sub-head leads a small sub-team, like Flowers or Lights.',
  'Sub-team name (e.g. Flowers)',
  'Name',
  'Phone',
  '📇 Pick contact',
  '+ Add another',
  'Members',
  'Share one link for many members (20 uses)',
  'Good for WhatsApp groups — anyone with the link joins as a member.',
  'Remove',
];

type Props = {
  t: T;
  showSubHeads: boolean;
  subHeads: SubHeadRow[];
  setSubHeads: (rows: SubHeadRow[]) => void;
  members: PersonRow[];
  setMembers: (rows: PersonRow[]) => void;
  groupLink: boolean;
  setGroupLink: (on: boolean) => void;
};

export function PeopleForm({ t, showSubHeads, subHeads, setSubHeads, members, setMembers, groupLink, setGroupLink }: Props) {
  const patchSub = (i: number, p: Partial<SubHeadRow>) => setSubHeads(subHeads.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const patchMem = (i: number, p: Partial<PersonRow>) => setMembers(members.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const pick = async (apply: (p: { name: string; phone: string }) => void) => {
    try {
      const c = await pickContact();
      if (c) apply(c);
    } catch {
      /* ignore picker errors */
    }
  };

  return (
    <View style={styles.wrap}>
      {showSubHeads ? (
        <>
          <SectionHeader title={t('Sub-heads')} />
          <Txt variant="small" color={C.inkSoft}>
            {t('Optional. A sub-head leads a small sub-team, like Flowers or Lights.')}
          </Txt>
          {subHeads.map((r, i) => (
            <Card key={`s${i}`} style={styles.card}>
              <Field
                label={t('Sub-team name (e.g. Flowers)')}
                value={r.team}
                onChangeText={(v) => patchSub(i, { team: v })}
                autoCapitalize="words"
              />
              <PersonFields t={t} row={r} onChange={(p) => patchSub(i, p)} />
              <View style={styles.actions}>
                {canPickContacts ? (
                  <Button title={t('📇 Pick contact')} size="sm" variant="secondary" inline onPress={() => pick((c) => patchSub(i, c))} />
                ) : null}
                {subHeads.length > 1 ? (
                  <Button title={t('Remove')} size="sm" variant="ghost" inline onPress={() => setSubHeads(subHeads.filter((_, j) => j !== i))} />
                ) : null}
              </View>
            </Card>
          ))}
          <Button title={t('+ Add another')} size="sm" variant="ghost" inline onPress={() => setSubHeads([...subHeads, emptySubHead()])} />
        </>
      ) : null}

      <SectionHeader title={t('Members')} />
      {members.map((r, i) => (
        <Card key={`m${i}`} style={styles.card}>
          <PersonFields t={t} row={r} onChange={(p) => patchMem(i, p)} />
          <View style={styles.actions}>
            {canPickContacts ? (
              <Button title={t('📇 Pick contact')} size="sm" variant="secondary" inline onPress={() => pick((c) => patchMem(i, c))} />
            ) : null}
            {members.length > 1 ? (
              <Button title={t('Remove')} size="sm" variant="ghost" inline onPress={() => setMembers(members.filter((_, j) => j !== i))} />
            ) : null}
          </View>
        </Card>
      ))}
      <Button title={t('+ Add another')} size="sm" variant="ghost" inline onPress={() => setMembers([...members, emptyPerson()])} />

      <CheckRow
        checked={groupLink}
        onToggle={() => setGroupLink(!groupLink)}
        title={t('Share one link for many members (20 uses)')}
        note={t('Good for WhatsApp groups — anyone with the link joins as a member.')}
      />
    </View>
  );
}

function PersonFields({ t, row, onChange }: { t: T; row: PersonRow; onChange: (p: Partial<PersonRow>) => void }) {
  return (
    <View style={styles.personRow}>
      <Field style={styles.flex} label={t('Name')} value={row.name} onChangeText={(v) => onChange({ name: v })} autoCapitalize="words" />
      <Field style={styles.flex} label={t('Phone')} value={row.phone} onChangeText={(v) => onChange({ phone: v })} keyboardType="phone-pad" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.sm, alignSelf: 'stretch' },
  card: { gap: 0, paddingBottom: S.sm },
  personRow: { flexDirection: 'row', gap: S.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
});
