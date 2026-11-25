import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { leaveWedding } from '@/lib/api';
import { useWedding } from '@/lib/wedding';

/**
 * Leave the wedding and remove my personal details (name shown as "Former member"; my notifications deleted;
 * my open invite links revoked). Two taps, no pop-up dialog. The Family Admin can't leave.
 */
export function LeaveWedding() {
  const { member, wedding, refresh } = useWedding();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!member || !wedding || member.role === 'admin') return null;

  async function leave() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await leaveWedding(wedding!.id);
      await refresh();
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {armed ? (
        <Txt variant="small" color={C.danger} center>
          Your name will be removed from {wedding.name} and you will lose access. Tap again to confirm.
        </Txt>
      ) : null}
      <Button
        title={armed ? 'Yes, leave and remove my details' : 'Leave this wedding'}
        variant={armed ? 'danger' : 'ghost'}
        size="md"
        loading={busy}
        onPress={leave}
      />
      {armed && !busy ? <Button title="Cancel" variant="ghost" size="sm" onPress={() => setArmed(false)} /> : null}
      {error ? (
        <Txt variant="small" color={C.danger} center>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: S.sm, marginTop: S.lg } });
