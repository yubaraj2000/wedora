import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PrivacyNote } from '@/components/PrivacyNote';
import { Button, Card, Field, LanguagePicker, Pill, Screen, Txt } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { acceptInvite, invitePreview } from '@/lib/api';
import { useSay } from '@/lib/say';
import { ROLE_LABEL, type InvitePreview, type Lang } from '@/lib/types';
import { useWedding } from '@/lib/wedding';

const HERO = require('../../../assets/images/theme/join-hero.jpg');

/** 01 Join via invite: preview the invite, pick name + language, join. */
export default function JoinScreen() {
  const { token: raw } = useLocalSearchParams<{ token: string }>();
  const token = Array.isArray(raw) ? raw[0] : (raw ?? '');
  const { ready, memberships, wedding, refresh } = useWedding();
  const { height } = useWindowDimensions();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lang, setLang] = useState<Lang>('en-IN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  useEffect(() => {
    if (!ready || !token || loadingRef.current) return;
    loadingRef.current = true;
    invitePreview(token)
      .then((p) => {
        setPreview(p);
        if (p) {
          setName(p.invitee_name ?? '');
          setLang(p.wedding_language ?? 'en-IN');
        }
      })
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => {
        setLoading(false);
        loadingRef.current = false;
      });
  }, [ready, token]);

  const roleLabel = preview ? ROLE_LABEL[preview.role] : '';
  const [tInvited, tName, tLang, tJoin, tAlready, tOpen, tInvalid, tHome, tNamePh, tByLine] = useSay(lang, [
    `You're invited to ${preview?.wedding ?? 'a wedding'}`,
    'Your name',
    'Choose your language',
    'Join',
    "You're already in this wedding",
    'Open',
    `This invite link is no longer valid — ask ${preview?.invited_by ?? 'the person who invited you'} for a new one.`,
    'Go home',
    'Type your name',
    `invited by ${preview?.invited_by ?? ''}`,
  ]);
  const [tRole] = useSay(lang, [roleLabel]);

  // Already a member of this wedding? (preview has no wedding id, so match by department or current wedding name.)
  const existing =
    preview &&
    (memberships.find((m) => m.department_id === preview.department_id) ??
      (wedding && wedding.name === preview.wedding ? memberships.find((m) => m.wedding_id === wedding.id) : undefined));

  const join = async () => {
    if (!name.trim()) {
      setError(tName);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const w = await acceptInvite(token, name.trim(), lang);
      await refresh(w);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      let w = existing?.wedding_id ?? null;
      try {
        w = await acceptInvite(token, name.trim() || existing?.display_name || 'Guest', lang);
      } catch {
        /* invite may be used up — fall back to the known membership */
      }
      if (!w) throw new Error('Could not open this wedding');
      await refresh(w);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const heroH = Math.round(height * 0.42);

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Image source={HERO} style={[styles.hero, { height: heroH }]} contentFit="cover" contentPosition="top" />

      {loading || !ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.maroon} size="large" />
        </View>
      ) : !preview || (!preview.valid && !existing) ? (
        <Card style={styles.card}>
          <Txt variant="h2" color={C.maroon}>
            🙏
          </Txt>
          <Txt variant="h3">{tInvalid}</Txt>
          {loadError ? (
            <Txt variant="small" color={C.danger}>
              {loadError}
            </Txt>
          ) : null}
          <Button title={tHome} variant="secondary" onPress={() => router.replace('/')} />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Txt variant="title" color={C.maroon}>
            {tInvited}
          </Txt>
          <View style={styles.metaRow}>
            <Txt variant="body" weight="600">
              {preview.department}
            </Txt>
            <Pill kind="level" label={tRole} />
            <Txt variant="small" color={C.inkSoft}>
              {tByLine}
            </Txt>
          </View>

          {existing ? (
            <>
              <Txt variant="body" color={C.inkSoft}>
                {tAlready}
              </Txt>
              <Button title={tOpen} icon="🪔" loading={busy} onPress={open} />
            </>
          ) : (
            <>
              <Field label={tName} value={name} onChangeText={setName} placeholder={tNamePh} autoCapitalize="words" />
              <Txt variant="small" weight="700">
                {tLang}
              </Txt>
              <LanguagePicker value={lang} onChange={setLang} />
              <View style={{ height: S.sm }} />
              <Button title={tJoin} loading={busy} onPress={join} disabled={!name.trim()} />
              <PrivacyNote lang={lang} />
            </>
          )}
          {error ? (
            <Txt variant="small" color={C.danger}>
              {error}
            </Txt>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  center: { paddingVertical: S.xxl, alignItems: 'center' },
  card: { marginTop: -S.xl, gap: S.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: S.sm },
});
