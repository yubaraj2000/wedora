import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Field, Txt } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { createInvite, createMinorDepartment } from '@/lib/api';
import { canPickContacts, inviteMessage, inviteUrl, openWhatsApp, pickContact } from '@/lib/invite';
import type { Department, Member, Wedding } from '@/lib/types';

import { type InviteRole, inviteDepartments, inviteRoles, LEVEL_LABEL } from './logic';

type Props = {
  me: Member;
  wedding: Wedding;
  departments: Department[];
  onCreated?: () => void;
  onClose?: () => void;
};

const NEW_SUB = '__new_sub__';

/** Inline "+ Invite" panel: only departments/levels below me; optional new sub-team; WhatsApp share. */
export function InvitePanel({ me, wedding, departments, onCreated, onClose }: Props) {
  const allowedDepts = useMemo(() => inviteDepartments(me, departments), [me, departments]);
  const [deptId, setDeptId] = useState<string | null>(allowedDepts.length === 1 ? allowedDepts[0].id : null);
  const [subParent, setSubParent] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [role, setRole] = useState<InviteRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<{ url: string; message: string; phone: string } | null>(null);

  const creatingSub = deptId === NEW_SUB;
  const dept = departments.find((d) => d.id === deptId);
  const roles: InviteRole[] = creatingSub ? ['sub_head'] : inviteRoles(me, dept);
  const chosenRole = role && roles.includes(role) ? role : roles.length === 1 ? roles[0] : null;

  // Majors where I may start a new sub-team: admin → any major, head → own major.
  const subParents = departments.filter(
    (d) => d.parent_id === null && (me.role === 'admin' || (me.role === 'head' && d.id === me.department_id)),
  );

  const pick = async () => {
    const c = await pickContact();
    if (c) {
      setName(c.name);
      setPhone(c.phone);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!deptId) return setErr('Pick a department');
    if (!chosenRole) return setErr('Pick a level');
    const parent = subParent ?? subParents[0]?.id;
    if (creatingSub && (!subName.trim() || !parent)) return setErr('Name the new sub-team');
    setBusy(true);
    try {
      let targetId = deptId;
      let targetName = dept?.name ?? '';
      if (creatingSub) {
        targetId = await createMinorDepartment(parent!, subName.trim());
        targetName = subName.trim();
      }
      const named = !!name.trim();
      const token = await createInvite(targetId, chosenRole, {
        maxUses: named ? 1 : 20,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      const url = inviteUrl(token);
      const message = inviteMessage({
        name: name.trim() || null,
        wedding: wedding.name,
        department: targetName,
        role: chosenRole,
        inviter: me.display_name,
        url,
      });
      setMade({ url, message, phone: phone.trim() });
      onCreated?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (made) {
    return (
      <Card style={styles.card}>
        <Txt variant="h3">Invite ready 🎉</Txt>
        <View style={styles.link}>
          <Txt variant="small" selectable>
            {made.url}
          </Txt>
        </View>
        <Button title="Send on WhatsApp" icon="💬" variant="success" size="md" onPress={() => openWhatsApp(made.phone || null, made.message)} />
        <View style={styles.row}>
          <Button
            title="Invite another"
            variant="secondary"
            size="sm"
            inline
            onPress={() => {
              setMade(null);
              setName('');
              setPhone('');
              setSubName('');
            }}
          />
          <Button title="Close" variant="ghost" size="sm" inline onPress={onClose} />
        </View>
      </Card>
    );
  }

  if (!allowedDepts.length && !subParents.length) {
    return (
      <Card style={styles.card}>
        <Txt>Your level can’t invite people.</Txt>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Txt variant="h3">Invite someone</Txt>

      <Txt variant="small" weight="700">
        Department
      </Txt>
      <View style={styles.chips}>
        {allowedDepts.map((d) => (
          <Chip key={d.id} label={d.parent_id ? `↳ ${d.name}` : d.name} selected={deptId === d.id} onPress={() => setDeptId(d.id)} />
        ))}
        {subParents.length ? (
          <Chip label="＋ New sub-team" selected={creatingSub} onPress={() => setDeptId(NEW_SUB)} />
        ) : null}
      </View>

      {creatingSub ? (
        <>
          {subParents.length > 1 ? (
            <>
              <Txt variant="small" weight="700">
                Under
              </Txt>
              <View style={styles.chips}>
                {subParents.map((d) => (
                  <Chip key={d.id} label={d.name} selected={(subParent ?? subParents[0].id) === d.id} onPress={() => setSubParent(d.id)} />
                ))}
              </View>
            </>
          ) : null}
          <Field label="Sub-team name" value={subName} onChangeText={setSubName} placeholder="Flowers" />
        </>
      ) : null}

      {deptId ? (
        <>
          <Txt variant="small" weight="700">
            Level
          </Txt>
          <View style={styles.chips}>
            {roles.length ? (
              roles.map((r) => <Chip key={r} label={LEVEL_LABEL[r]} selected={chosenRole === r} onPress={() => setRole(r)} />)
            ) : (
              <Txt variant="small" color={C.inkSoft}>
                No level you can invite here.
              </Txt>
            )}
          </View>
        </>
      ) : null}

      <Field label="Name (optional — leave empty for a group link)" value={name} onChangeText={setName} placeholder="Sunita" />
      <Field label="WhatsApp number (optional)" value={phone} onChangeText={setPhone} placeholder="98xxxxxxxx" keyboardType="phone-pad" />
      {canPickContacts ? <Button title="Pick from contacts" icon="📇" variant="ghost" size="sm" inline onPress={pick} /> : null}
      <Txt variant="caption" color={C.inkSoft}>
        {name.trim() ? 'Single-use link for this person' : 'Group link — up to 20 people can join'}
      </Txt>
      {err ? <Txt color={C.danger}>{err}</Txt> : null}
      <View style={styles.row}>
        <Button title="Create invite" size="md" onPress={submit} loading={busy} style={styles.flex} />
        <Button title="Cancel" variant="ghost" size="md" inline onPress={onClose} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: S.sm, marginBottom: S.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  flex: { flex: 1 },
  link: { backgroundColor: C.cream, borderRadius: R.sm, padding: S.sm, borderWidth: 1, borderColor: C.line },
});
