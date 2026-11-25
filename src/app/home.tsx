import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EMPTY_IMAGES, EmptyState, ListRow, Pill, Screen, SectionHeader, Txt } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { ApprovalCard, MyExpenseRow } from '@/features/home/ExpenseCard';
import { FlagsCard } from '@/features/home/FlagsCard';
import { canChangeTask, canDecide, hhmm, isLeader, myDeptScope, taskTitle } from '@/features/home/logic';
import { TaskRow } from '@/features/home/TaskRow';
import { useWeddingData } from '@/features/home/useWeddingData';
import { VoiceButton } from '@/features/voice/VoiceButton';
import { markRead } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/types';
import { useFlag, useWedding } from '@/lib/wedding';

export default function Home() {
  const { ready, member, wedding } = useWedding();
  const data = useWeddingData(['departments', 'members', 'tasks', 'expenses', 'notifications']);
  const { departments, tasks, expenses, notifications, membersById, deptsById, reload } = data;
  const canTeam = useFlag('invite_people');
  const canDash = useFlag('budget_dashboard');
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (ready && !member) router.replace('/');
  }, [ready, member]);

  const toApprove = useMemo(
    () => (member ? expenses.filter((e) => e.status === 'pending' && e.approver_id === member.id && canDecide(member, e)) : []),
    [expenses, member],
  );
  const myTasks = useMemo(() => {
    if (!member || member.role === 'admin') return [];
    const scope = myDeptScope(member, departments);
    return tasks.filter((t) => t.assigned_to === member.id || scope.has(t.department_id));
  }, [tasks, departments, member]);
  const myExpenses = useMemo(() => (member ? expenses.filter((e) => e.submitted_by === member.id) : []), [expenses, member]);
  const myNotes = useMemo(() => (member ? notifications.filter((n) => n.to_member === member.id) : []), [notifications, member]);
  const unread = myNotes.filter((n) => !n.read).length;

  if (!member || !wedding) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Wedora' }} />
        <EmptyState source={EMPTY_IMAGES.waiting} title="Loading…" />
      </Screen>
    );
  }

  const openNotes = async () => {
    const next = !showNotes;
    setShowNotes(next);
    if (next && unread) {
      try {
        await markRead(wedding.id);
        reload();
      } catch {
        /* non-fatal */
      }
    }
  };

  const dept = member.department_id ? deptsById[member.department_id] : undefined;

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: wedding.name }} />

      {/* Greeting */}
      <Card style={styles.greet}>
        <View style={styles.flex}>
          <Txt variant="h2">Namaste {member.display_name} 🙏</Txt>
          <View style={styles.inline}>
            <Pill kind="level" label={ROLE_LABEL[member.role]} />
            {dept ? <Txt color={C.inkSoft}>{dept.name}</Txt> : null}
          </View>
        </View>
        <Pressable onPress={openNotes} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${unread} new notifications`}>
          <Txt variant="h2">🔔</Txt>
          {unread ? (
            <View style={styles.badge}>
              <Txt variant="caption" color={C.white} weight="800">
                {unread > 9 ? '9+' : unread}
              </Txt>
            </View>
          ) : null}
        </Pressable>
      </Card>

      {showNotes ? (
        <Card style={styles.section}>
          <Txt variant="h3">Notifications</Txt>
          {myNotes.length ? (
            myNotes.slice(0, 10).map((n, i, arr) => (
              <ListRow
                key={n.id}
                left={n.read ? '•' : '🟠'}
                title={n.body}
                subtitle={hhmm(n.created_at)}
                divider={i < arr.length - 1}
              />
            ))
          ) : (
            <Txt color={C.inkSoft}>Nothing new.</Txt>
          )}
        </Card>
      ) : null}

      {data.error ? (
        <Txt variant="small" color={C.danger}>
          {data.error}
        </Txt>
      ) : null}

      <VoiceButton />

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="Expense" icon="＋" size="md" inline onPress={() => router.push('/expense/new')} />
        {isLeader(member) ? (
          <Button title="Task" icon="＋" size="md" variant="secondary" inline onPress={() => router.push('/task/new')} />
        ) : null}
        {canTeam ? <Button title="Team" icon="👥" size="md" variant="secondary" inline onPress={() => router.push('/team')} /> : null}
        {canDash ? (
          <Button title="Dashboard" icon="📊" size="md" variant="secondary" inline onPress={() => router.push('/admin')} />
        ) : null}
      </View>

      {/* Approvals */}
      {toApprove.length ? (
        <>
          <SectionHeader title={`Needs your approval (${toApprove.length})`} />
          {toApprove.map((e) => (
            <ApprovalCard key={e.id} expense={e} members={membersById} depts={deptsById} onDone={reload} />
          ))}
        </>
      ) : null}

      {/* Tasks */}
      {member.role === 'admin' ? (
        <>
          <SectionHeader title="Tasks" />
          <Card onPress={() => router.push('/admin')}>
            <Txt weight="600">You see every department. Open the dashboard for tasks and budget →</Txt>
          </Card>
        </>
      ) : (
        <>
          <SectionHeader title="My tasks" />
          {myTasks.length ? (
            <Card style={styles.list}>
              {myTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  title={taskTitle(t, member)}
                  subtitle={[
                    deptsById[t.department_id]?.name,
                    t.assigned_to ? `→ ${membersById[t.assigned_to]?.display_name ?? ''}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  editable={canChangeTask(member, t, departments)}
                  onChanged={reload}
                />
              ))}
            </Card>
          ) : (
            <EmptyState source={EMPTY_IMAGES.tasks} title="No tasks yet" body="Tasks for your team will show up here." />
          )}
        </>
      )}

      {/* My expenses */}
      <SectionHeader title="My expenses" actionTitle="+ Add" onAction={() => router.push('/expense/new')} />
      {myExpenses.length ? (
        <Card style={styles.list}>
          {myExpenses.map((e) => (
            <MyExpenseRow key={e.id} expense={e} members={membersById} />
          ))}
        </Card>
      ) : (
        <EmptyState source={EMPTY_IMAGES.expenses} title="No expenses yet" body="Paid for something? Add it and it goes to the right person." />
      )}

      <FlagsCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: S.xs },
  greet: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: R.pill,
    backgroundColor: C.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  section: { marginTop: S.md, gap: S.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.md },
  list: { paddingVertical: S.xs },
});
