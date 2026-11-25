import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, formatINR, Pill, Screen, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { LEVEL_LABEL } from '@/features/home/logic';
import { useWeddingData } from '@/features/home/useWeddingData';
import { submitExpense } from '@/lib/api';
import type { Expense } from '@/lib/types';
import { useWedding } from '@/lib/wedding';

type Result = { expense: Expense; limits: { sub_head: number; head: number }; flags_source: string };

export default function NewExpense() {
  const { member, wedding } = useWedding();
  const { membersById, deptsById } = useWeddingData(['members', 'departments']);
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const dept = member?.department_id ? deptsById[member.department_id] : undefined;

  const submit = async () => {
    if (!wedding) return;
    if (!amount.trim()) return setErr('How much did you pay?');
    if (!what.trim()) return setErr('What was it for?');
    setBusy(true);
    setErr(null);
    try {
      const plain = amount.replace(/[₹,\s]/g, '');
      const amt: number | string = /^\d+(\.\d+)?$/.test(plain) ? Number(plain) : amount.trim();
      setResult(
        await submitExpense(wedding.id, {
          amount: amt,
          description: what.trim(),
          paid_to: paidTo.trim() || undefined,
          source: 'form',
        }),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const e = result.expense;
    const approver = e.approver_id ? membersById[e.approver_id]?.display_name : null;
    const level = LEVEL_LABEL[e.approval_level] ?? e.approval_level;
    const amt = Number(e.amount);
    const { sub_head, head } = result.limits;
    const why =
      amt <= sub_head
        ? `${formatINR(amt)} is within the ${formatINR(sub_head)} sub-head limit`
        : amt <= head
          ? `${formatINR(amt)} is above the ${formatINR(sub_head)} sub-head limit`
          : `${formatINR(amt)} is above the ${formatINR(head)} head limit`;
    return (
      <Screen scroll edges={['bottom']}>
        <Stack.Screen options={{ title: 'Expense sent' }} />
        <Card style={styles.result}>
          <Txt variant="title" color={C.maroon}>
            {formatINR(amt)}
          </Txt>
          <Txt variant="h3">{e.description}</Txt>
          <Pill kind={e.status} />
          <Txt>
            Sent to <Txt weight="800">{approver ?? level}</Txt> ({level}) because {why}.
          </Txt>
          <Txt variant="small" color={C.inkSoft}>
            Limits from {result.flags_source === 'flagsmith' ? 'Flagsmith' : 'defaults'}: sub-head {formatINR(sub_head)}, head{' '}
            {formatINR(head)}
          </Txt>
        </Card>
        <Button title="Done" onPress={() => router.back()} style={styles.mt} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'New expense' }} />
      <Txt color={C.inkSoft} style={styles.mb}>
        Department: <Txt weight="700">{dept?.name ?? '—'}</Txt>
      </Txt>
      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={setAmount}
        placeholder="12000 or 12k or 12 hazar"
        keyboardType="default"
        autoFocus
      />
      <Field label="What for?" value={what} onChangeText={setWhat} placeholder="Marigold garlands for haldi" />
      <Field label="Paid to (optional)" value={paidTo} onChangeText={setPaidTo} placeholder="Ramesh Flowers" />
      {err ? (
        <Txt color={C.danger} style={styles.mb}>
          {err}
        </Txt>
      ) : null}
      <View style={styles.mt}>
        <Button title="Send for approval" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { gap: S.sm },
  mt: { marginTop: S.lg },
  mb: { marginBottom: S.md },
});
