import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, EMPTY_IMAGES, EmptyState, Pill, Screen, SectionHeader, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { InvitePanel } from '@/features/home/InvitePanel';
import { hhmm, LEVEL_LABEL } from '@/features/home/logic';
import { TeamTree } from '@/features/home/TeamTree';
import { useWeddingData } from '@/features/home/useWeddingData';
import { revokeInvite } from '@/lib/api';
import { inviteMessage, inviteUrl, openWhatsApp } from '@/lib/invite';
import type { Invite } from '@/lib/types';
import { useFlag, useWedding } from '@/lib/wedding';

export default function Team() {
  const { member, wedding } = useWedding();
  const canInvite = useFlag('invite_people');
  const { departments, members, invites, membersById, deptsById, reload, error } = useWeddingData([
    'departments',
    'members',
    'invites',
  ]);
  const [inviting, setInviting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!member || !wedding) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Who joined' }} />
        <EmptyState source={EMPTY_IMAGES.waiting} title="Loading…" />
      </Screen>
    );
  }

  const share = (i: Invite) => {
    const msg = inviteMessage({
      name: i.invitee_name,
      wedding: wedding.name,
      department: deptsById[i.department_id]?.name ?? '',
      role: i.role,
      inviter: membersById[i.created_by]?.display_name ?? member.display_name,
      url: inviteUrl(i.token),
    });
    openWhatsApp(i.invitee_phone, msg).catch((e) => setErr((e as Error).message));
  };

  const revoke = async (i: Invite) => {
    setErr(null);
    try {
      await revokeInvite(i.token);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const mayInvite = canInvite && member.role !== 'member';

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Who joined' }} />
      {error || err ? (
        <Txt variant="small" color={C.danger}>
          {err ?? error}
        </Txt>
      ) : null}

      <View style={styles.headRow}>
        <Txt variant="h2" style={styles.flex}>
          {members.length} joined
        </Txt>
        {mayInvite && !inviting ? <Button title="Invite" icon="＋" size="sm" inline onPress={() => setInviting(true)} /> : null}
      </View>

      {inviting ? (
        <InvitePanel me={member} wedding={wedding} departments={departments} onCreated={reload} onClose={() => setInviting(false)} />
      ) : null}

      <TeamTree departments={departments} members={members} membersById={membersById} meId={member.id} />

      {mayInvite || invites.length ? (
        <>
          <SectionHeader title="Invite links" />
          {invites.length ? (
            invites.map((i) => {
              const full = i.uses >= i.max_uses;
              const dead = i.revoked || full;
              return (
                <Card key={i.id} style={[styles.invite, dead && styles.dead]}>
                  <View style={styles.headRow}>
                    <Txt weight="700" style={styles.flex} numberOfLines={1}>
                      {deptsById[i.department_id]?.name ?? '—'} · {LEVEL_LABEL[i.role]}
                    </Txt>
                    {i.revoked ? <Pill kind="rejected" label="Revoked" /> : full ? <Pill kind="completed" label="Used" /> : <Pill kind="in_progress" label="Active" />}
                  </View>
                  <Txt variant="small" color={C.inkSoft}>
                    {i.invitee_name ?? 'Group link'} · uses {i.uses}/{i.max_uses} · {hhmm(i.created_at)}
                    {member.role === 'admin' && i.created_by !== member.id ? ` · by ${membersById[i.created_by]?.display_name ?? '?'}` : ''}
                  </Txt>
                  {!dead ? (
                    <View style={styles.btns}>
                      <Button title="WhatsApp" icon="💬" variant="success" size="sm" inline onPress={() => share(i)} />
                      <Button title="Revoke" variant="ghost" size="sm" inline onPress={() => revoke(i)} />
                    </View>
                  ) : null}
                </Card>
              );
            })
          ) : (
            <Txt color={C.inkSoft}>No invite links yet.</Txt>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  invite: { gap: S.xs, marginBottom: S.sm, padding: S.md },
  dead: { opacity: 0.6 },
  btns: { flexDirection: 'row', gap: S.sm, marginTop: S.xs },
});
