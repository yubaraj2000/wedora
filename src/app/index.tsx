import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { C, S } from '@/constants/theme';
import { ensureSession } from '@/lib/supabase';

// Temporary check screen (step 0b): proves the app reaches Supabase.
export default function Home() {
  const [status, setStatus] = useState('Connecting to Supabase…');

  useEffect(() => {
    ensureSession()
      .then((s) => setStatus(`Connected ✓ (device user ${s.user.id.slice(0, 8)})`))
      .catch((e) => setStatus(`Error: ${e.message}`));
  }, []);

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: 'Wedora' }} />
      <Text style={styles.title}>Wedora</Text>
      <Text style={styles.sub}>Your family wedding, run together.</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md },
  title: { fontSize: 36, fontWeight: '800', color: C.maroon },
  sub: { fontSize: 16, color: C.inkSoft },
  status: { marginTop: S.lg, fontSize: 14, color: C.leaf },
});
