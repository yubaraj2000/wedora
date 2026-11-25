import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Pill, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { inviteMessage, inviteUrl, openWhatsApp } from '@/lib/invite';
import type { Role } from '@/lib/types';

import type { T } from './useT';

export type CreatedInvite = {
  key: string;
  token: string;
  name: string | null;
  phone: string | null;
  role: Exclude<Role, 'admin'>;
  department: string;
  group?: boolean;
};

export const INVITE_LINES = [
  'Send on WhatsApp',
  '✓ Sent',
  'Copy link',
  'Copied',
  'Group link · 20 uses',
  'Sub-head',
  'Member',
];

type Props = { t: T; invites: CreatedInvite[]; wedding: string; inviter: string };

export function InviteList({ t, invites, wedding, inviter }: Props) {
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      {invites.map((inv) => {
        const url = inviteUrl(inv.token);
        const msg = inviteMessage({ name: inv.name, wedding, department: inv.department, role: inv.role, inviter, url });
        return (
          <Card key={inv.key} style={styles.card}>
            <View style={styles.head}>
              <Txt variant="h3" style={styles.flex} numberOfLines={1}>
                {inv.group ? t('Group link · 20 uses') : inv.name || inv.phone || t('Member')}
              </Txt>
              <Pill kind="level" label={`${inv.department} · ${t(inv.role === 'sub_head' ? 'Sub-head' : 'Member')}`} />
            </View>
            <Txt variant="small" color={C.inkSoft} selectable>
              {url}
            </Txt>
            <View style={styles.actions}>
              <Button
                title={t('Send on WhatsApp')}
                icon="💬"
                size="sm"
                variant="success"
                inline
                onPress={async () => {
                  await openWhatsApp(inv.phone, msg).catch(() => undefined);
                  setSent((s) => ({ ...s, [inv.key]: true }));
                }}
              />
              <Button
                title={copied === inv.key ? t('Copied') : t('Copy link')}
                size="sm"
                variant="secondary"
                inline
                onPress={async () => {
                  await Clipboard.setStringAsync(msg).catch(() => undefined);
                  setCopied(inv.key);
                }}
              />
              {sent[inv.key] ? <Pill kind="completed" label={t('✓ Sent')} /> : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.md, alignSelf: 'stretch' },
  card: { gap: S.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
});
