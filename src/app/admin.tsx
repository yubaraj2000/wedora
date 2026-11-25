import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, EMPTY_IMAGES, EmptyState, formatINR, Screen, SectionHeader, Txt } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useWeddingData } from '@/features/home/useWeddingData';
import { useFlag, useWedding } from '@/lib/wedding';

const HEADER = require('../../assets/images/theme/admin-header.jpg');

export default function AdminDashboard() {
  const { wedding } = useWedding();
  const allowed = useFlag('budget_dashboard');
  const { departments, members, tasks, expenses, error } = useWeddingData(['departments', 'members', 'tasks', 'expenses']);

  const sums = useMemo(() => {
    let approved = 0;
    let pending = 0;
    for (const e of expenses) {
      if (e.status === 'approved') approved += Number(e.amount);
      else if (e.status === 'pending') pending += Number(e.amount);
    }
    return { approved, pending };
  }, [expenses]);

  const rows = useMemo(() => {
    const majors = departments.filter((d) => d.parent_id === null);
    return majors.map((d) => {
      const ids = new Set([d.id, ...departments.filter((x) => x.parent_id === d.id).map((x) => x.id)]);
      const dTasks = tasks.filter((t) => ids.has(t.department_id));
      const spend = expenses
        .filter((e) => e.status === 'approved' && ids.has(e.department_id))
        .reduce((a, e) => a + Number(e.amount), 0);
      const heads = members.filter((m) => m.role === 'head' && m.department_id === d.id).map((m) => m.display_name);
      return {
        dept: d,
        heads,
        done: dTasks.filter((t) => t.status === 'completed').length,
        total: dTasks.length,
        spend,
        subTeams: ids.size - 1,
      };
    });
  }, [departments, tasks, expenses, members]);

  if (!allowed) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Dashboard' }} />
        <EmptyState source={EMPTY_IMAGES.waiting} title="Not available for your level" body="The family admin can turn this on in Flagsmith." />
      </Screen>
    );
  }

  const budget = Number(wedding?.budget ?? 0);
  const remaining = budget - sums.approved - sums.pending;
  const base = Math.max(budget, sums.approved + sums.pending, 1);

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Dashboard' }} />
      <Image source={HEADER} style={styles.band} contentFit="cover" accessible={false} />

      {error ? (
        <Txt variant="small" color={C.danger}>
          {error}
        </Txt>
      ) : null}

      <Card style={styles.budget}>
        <Txt variant="caption" color={C.inkSoft}>
          BUDGET
        </Txt>
        <Txt variant="title" color={C.maroon}>
          {budget ? formatINR(budget) : 'Not set'}
        </Txt>
        <View style={styles.bar}>
          <View style={{ flex: sums.approved / base, backgroundColor: C.leaf }} />
          <View style={{ flex: sums.pending / base, backgroundColor: C.marigold }} />
          <View style={{ flex: Math.max(0, remaining) / base, backgroundColor: C.line }} />
        </View>
        <View style={styles.legend}>
          <Stat color={C.leaf} label="Approved" value={formatINR(sums.approved)} />
          <Stat color={C.marigold} label="Pending" value={formatINR(sums.pending)} />
          <Stat color={remaining < 0 ? C.danger : C.line} label="Remaining" value={formatINR(remaining)} />
        </View>
      </Card>

      <Button title="Who joined" icon="👥" variant="secondary" size="md" onPress={() => router.push('/team')} style={styles.mt} />

      <SectionHeader title="Departments" />
      <View style={styles.grid}>
        {rows.map((r) => (
          <Card key={r.dept.id} style={styles.cell}>
            <Txt variant="h3" numberOfLines={1}>
              {r.dept.name}
            </Txt>
            <Txt variant="small" color={C.inkSoft} numberOfLines={1}>
              {r.heads.length ? `Head: ${r.heads.join(', ')}` : 'No head yet'}
            </Txt>
            <View style={styles.progress}>
              <View style={{ flex: r.done, backgroundColor: C.leaf }} />
              <View style={{ flex: Math.max(r.total - r.done, r.total ? 0 : 1), backgroundColor: C.line }} />
            </View>
            <Txt variant="small">
              Tasks {r.done}/{r.total}
            </Txt>
            <Txt variant="small" weight="700">
              Spent {formatINR(r.spend)}
            </Txt>
            {r.subTeams ? (
              <Txt variant="caption" color={C.inkSoft}>
                {r.subTeams} sub-team{r.subTeams > 1 ? 's' : ''}
              </Txt>
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View>
        <Txt variant="caption" color={C.inkSoft}>
          {label}
        </Txt>
        <Txt variant="small" weight="700">
          {value}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { height: 140, borderRadius: R.lg, marginBottom: S.md, width: '100%' },
  budget: { gap: S.sm },
  bar: { flexDirection: 'row', height: 14, borderRadius: R.pill, overflow: 'hidden', backgroundColor: C.line },
  legend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: S.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  mt: { marginTop: S.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: S.sm },
  cell: { width: '48.5%', gap: 2, padding: S.md },
  progress: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: S.xs },
});
