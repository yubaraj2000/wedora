import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Pill, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import type { Department, Member } from '@/lib/types';

import { type ById, hhmm, LEVEL_LABEL } from './logic';

function PersonRow({ m, members, depth, me }: { m: Member; members: ById<Member>; depth: number; me?: string }) {
  const inviter = m.invited_by ? members[m.invited_by]?.display_name : null;
  return (
    <View style={[styles.person, { paddingLeft: depth * 18 }]}>
      <Txt variant="h3" style={styles.avatar}>
        {m.role === 'admin' ? '👑' : m.role === 'head' ? '⭐' : m.role === 'sub_head' ? '🔸' : '•'}
      </Txt>
      <View style={styles.flex}>
        <Txt weight="700">
          {m.display_name}
          {m.id === me ? ' (you)' : ''}
        </Txt>
        <Txt variant="caption" color={C.inkSoft}>
          {inviter ? `invited by ${inviter} · ` : ''}
          {hhmm(m.joined_at)}
        </Txt>
      </View>
      <Pill kind={m.role === 'member' ? 'neutral' : 'level'} label={LEVEL_LABEL[m.role]} />
    </View>
  );
}

type Props = { departments: Department[]; members: Member[]; membersById: ById<Member>; meId?: string };

/** "Who joined" tree: Admin → major departments (heads, members) → sub-teams (sub-heads, members). */
export function TeamTree({ departments, members, membersById, meId }: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const admins = members.filter((m) => m.role === 'admin');
  const majors = departments.filter((d) => d.parent_id === null);
  const rank = { admin: 0, head: 1, sub_head: 2, member: 3 } as const;
  const inDept = (id: string) => members.filter((m) => m.department_id === id && m.role !== 'admin').sort((a, b) => rank[a.role] - rank[b.role]);

  return (
    <View style={styles.wrap}>
      {admins.map((a) => (
        <Card key={a.id} style={styles.adminCard}>
          <PersonRow m={a} members={membersById} depth={0} me={meId} />
        </Card>
      ))}
      {majors.map((d) => {
        const subs = departments.filter((x) => x.parent_id === d.id);
        const people = inDept(d.id);
        const count = people.length + subs.reduce((n, s) => n + inDept(s.id).length, 0);
        const open = !closed[d.id];
        return (
          <Card key={d.id} style={styles.dept}>
            <Pressable
              onPress={() => setClosed((c) => ({ ...c, [d.id]: open }))}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={styles.deptHead}>
              <Txt variant="h3" style={styles.flex}>
                {open ? '▾' : '▸'} {d.name}
              </Txt>
              <Txt variant="small" color={C.inkSoft}>
                {count} {count === 1 ? 'person' : 'people'}
              </Txt>
            </Pressable>
            {open ? (
              <>
                {people.map((m) => (
                  <PersonRow key={m.id} m={m} members={membersById} depth={1} me={meId} />
                ))}
                {subs.map((s) => (
                  <View key={s.id} style={styles.sub}>
                    <Txt weight="700" color={C.maroon} style={styles.subTitle}>
                      ↳ {s.name}
                    </Txt>
                    {inDept(s.id).map((m) => (
                      <PersonRow key={m.id} m={m} members={membersById} depth={2} me={meId} />
                    ))}
                    {!inDept(s.id).length ? (
                      <Txt variant="caption" color={C.inkSoft} style={styles.empty}>
                        No one yet
                      </Txt>
                    ) : null}
                  </View>
                ))}
                {!count && !subs.length ? (
                  <Txt variant="caption" color={C.inkSoft} style={styles.empty}>
                    No one yet
                  </Txt>
                ) : null}
              </>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.sm },
  adminCard: { paddingVertical: S.xs, backgroundColor: C.marigoldSoft },
  dept: { paddingVertical: S.sm },
  deptHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  person: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs + 2 },
  avatar: { width: 26 },
  flex: { flex: 1 },
  sub: { marginTop: S.xs },
  subTitle: { paddingLeft: 18, paddingVertical: S.xs },
  empty: { paddingLeft: 44, paddingBottom: S.xs },
});
