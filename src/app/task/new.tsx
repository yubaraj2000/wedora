import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, EmptyState, Field, Screen, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { taskDepartments } from '@/features/home/logic';
import { useWeddingData } from '@/features/home/useWeddingData';
import { createTask } from '@/lib/api';
import { useWedding } from '@/lib/wedding';

export default function NewTask() {
  const { member } = useWedding();
  const { departments, members } = useWeddingData(['departments', 'members']);
  const allowed = useMemo(() => (member ? taskDepartments(member, departments) : []), [member, departments]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dept = deptId ?? (allowed.length === 1 ? allowed[0].id : null);
  const people = members.filter((m) => m.department_id === dept);

  if (!member || member.role === 'member') {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'New task' }} />
        <EmptyState title="Only leaders can add tasks" />
      </Screen>
    );
  }

  const save = async () => {
    if (!dept) return setErr('Pick a department');
    if (!title.trim()) return setErr('What needs to be done?');
    setBusy(true);
    setErr(null);
    try {
      await createTask(dept, title.trim(), assignee);
      router.back();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'New task' }} />
      <Txt variant="small" weight="700" style={styles.label}>
        Department
      </Txt>
      <View style={styles.chips}>
        {allowed.map((d) => (
          <Chip
            key={d.id}
            label={d.parent_id ? `↳ ${d.name}` : d.name}
            selected={dept === d.id}
            onPress={() => {
              setDeptId(d.id);
              setAssignee(null);
            }}
          />
        ))}
      </View>
      <Field label="Task" value={title} onChangeText={setTitle} placeholder="Book the shehnai players" />
      {dept && people.length ? (
        <>
          <Txt variant="small" weight="700" style={styles.label}>
            Assign to (optional)
          </Txt>
          <View style={styles.chips}>
            {people.map((p) => (
              <Chip key={p.id} label={p.display_name} selected={assignee === p.id} onPress={() => setAssignee(assignee === p.id ? null : p.id)} />
            ))}
          </View>
        </>
      ) : null}
      {err ? (
        <Txt color={C.danger} style={styles.label}>
          {err}
        </Txt>
      ) : null}
      <Button title="Add task" onPress={save} loading={busy} style={styles.mt} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: S.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg },
  mt: { marginTop: S.md },
});
