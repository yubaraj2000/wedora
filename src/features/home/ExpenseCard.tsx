import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, formatINR, Pill, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { decideExpense } from '@/lib/api';
import type { Department, Expense, Member } from '@/lib/types';

import { type ById, LEVEL_LABEL, routeReason } from './logic';

type Props = {
  expense: Expense;
  members: ById<Member>;
  depts: ById<Department>;
  onDone?: () => void;
};

/** Card for an expense waiting on me: amount, who/what, routing reason, Approve / Reject. */
export function ApprovalCard({ expense: e, members, depts, onDone }: Props) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'yes' : 'no');
    setErr(null);
    try {
      await decideExpense(e.id, approve);
      onDone?.();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Txt variant="title" color={C.maroon}>
          {formatINR(Number(e.amount))}
        </Txt>
        <Pill kind="pending" />
      </View>
      <Txt variant="h3">{e.description}</Txt>
      {e.paid_to ? <Txt color={C.inkSoft}>Paid to {e.paid_to}</Txt> : null}
      <Txt variant="small" color={C.inkSoft}>
        By {members[e.submitted_by]?.display_name ?? 'someone'} · {depts[e.department_id]?.name ?? ''}
      </Txt>
      <View style={styles.reason}>
        <Txt variant="small" color={C.pendingText} weight="600">
          {routeReason(e, members)}
        </Txt>
      </View>
      {err ? (
        <Txt variant="small" color={C.danger}>
          {err}
        </Txt>
      ) : null}
      <View style={styles.row}>
        <Button
          title="Approve"
          icon="✓"
          variant="success"
          size="md"
          style={styles.flex}
          loading={busy === 'yes'}
          disabled={!!busy}
          onPress={() => decide(true)}
        />
        <Button
          title="Reject"
          icon="✕"
          variant="danger"
          size="md"
          style={styles.flex}
          loading={busy === 'no'}
          disabled={!!busy}
          onPress={() => decide(false)}
        />
      </View>
    </Card>
  );
}

/** Compact row for one of my own expenses. */
export function MyExpenseRow({ expense: e, members }: { expense: Expense; members: ById<Member> }) {
  const approver = e.approver_id ? members[e.approver_id]?.display_name : null;
  const decider = e.decided_by ? members[e.decided_by]?.display_name : null;
  const level = LEVEL_LABEL[e.approval_level] ?? e.approval_level;
  const line =
    e.status === 'pending'
      ? `Waiting for ${approver ?? level}`
      : `${e.status === 'approved' ? 'Approved' : 'Rejected'} by ${decider ?? approver ?? level}${e.decision_note ? ` — “${e.decision_note}”` : ''}`;
  return (
    <View style={styles.myRow}>
      <View style={styles.flex}>
        <Txt weight="600" numberOfLines={2}>
          {e.description}
        </Txt>
        <Txt variant="small" color={C.inkSoft}>
          {line}
        </Txt>
      </View>
      <View style={styles.right}>
        <Txt weight="700">{formatINR(Number(e.amount))}</Txt>
        <Pill kind={e.status} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: S.xs, marginBottom: S.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reason: { backgroundColor: C.marigoldSoft, borderRadius: 8, padding: S.sm, marginTop: S.xs },
  row: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  flex: { flex: 1 },
  myRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  right: { alignItems: 'flex-end', gap: S.xs },
});
