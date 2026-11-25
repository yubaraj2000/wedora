import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useWedding } from '@/lib/wedding';

const HERO = require('../../assets/images/theme/join-hero.jpg');

/** Entry: sends each person to welcome, onboarding or home. */
export default function Index() {
  const { ready, error, member } = useWedding();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.maroon} size="large" />
      </View>
    );
  }
  if (member) {
    if (!member.onboarding_done) {
      return <Redirect href={member.role === 'admin' ? '/onboarding/admin' : '/onboarding/team'} />;
    }
    return <Redirect href="/home" />;
  }
  return <Welcome error={error} />;
}

function Welcome({ error }: { error: string | null }) {
  const [link, setLink] = useState('');
  const token = link.trim().split('/join/').pop()?.split(/[?#]/)[0] ?? '';

  return (
    <Screen scroll edges={['bottom']}>
      <Image source={HERO} style={styles.hero} contentFit="cover" contentPosition="top" />
      <View style={styles.body}>
        <Txt variant="title" color={C.maroon}>
          Wedora
        </Txt>
        <Txt variant="body" color={C.inkSoft}>
          Run your family&apos;s wedding together — in Odia, Hindi, Bengali or English.
        </Txt>

        <Button title="Start planning a wedding" icon="🪔" onPress={() => router.push('/onboarding/admin')} />

        <Card>
          <Txt variant="h3">Got an invite?</Txt>
          <Txt variant="small" color={C.inkSoft}>
            Open the link from WhatsApp, or paste it here.
          </Txt>
          <View style={{ height: S.sm }} />
          <Field value={link} onChangeText={setLink} placeholder="https://…/join/…" autoCapitalize="none" />
          <View style={{ height: S.sm }} />
          <Button
            title="Open invite"
            variant="secondary"
            disabled={token.length < 8}
            onPress={() => router.push(`/join/${token}`)}
          />
        </Card>
        {error ? (
          <Txt variant="small" color={C.danger}>
            {error}
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream },
  hero: { width: '100%', height: 340, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  body: { gap: S.lg, paddingVertical: S.xl },
});
