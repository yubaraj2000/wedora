import { StyleSheet, View } from 'react-native';

import { Button, Card, Pill, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';

import type { Labels } from './labels';
import type { SentInvite } from './model';

type Props = {
  invites: SentInvite[];
  linkFor: (inv: SentInvite) => string;
  onSend: (inv: SentInvite) => void;
  onFinish: () => void;
  busy?: boolean;
  L: Labels;
};

export function InvitesPanel({ invites, linkFor, onSend, onFinish, busy, L }: Props) {
  return (
    <>
      {!invites.length ? (
        <Txt variant="small" color={C.inkSoft}>
          {L.noHeads}
        </Txt>
      ) : null}
      {invites.map((inv) => (
        <Card key={inv.deptId}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Txt variant="body" weight="700">
                {inv.name}
              </Txt>
              <Txt variant="small" color={C.inkSoft}>
                {inv.dept}
                {inv.phone ? ` · ${inv.phone}` : ''}
              </Txt>
            </View>
            {inv.sent ? <Pill kind="completed" label={`✓ ${L.sent}`} /> : null}
          </View>
          <Txt variant="caption" color={C.inkSoft} selectable style={styles.link}>
            {linkFor(inv)}
          </Txt>
          <Button
            title={L.sendWA}
            icon="💬"
            onPress={() => onSend(inv)}
            variant={inv.sent ? 'secondary' : 'success'}
            size="md"
          />
        </Card>
      ))}
      <Button title={L.goDashboard} onPress={onFinish} loading={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  flex: { flex: 1 },
  link: { marginVertical: S.sm },
});
