import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { getFeatures, getMyMemberships, getWedding } from './api';
import { ensureSession, supabase } from './supabase';
import type { FlagName, Flags, Member, Wedding } from './types';

const KEY = 'wedora.currentWedding';
const FLAG_POLL_MS = 10_000;

type Ctx = {
  ready: boolean;
  error: string | null;
  userId: string | null;
  memberships: Member[];
  member: Member | null;
  wedding: Wedding | null;
  flags: Flags;
  flagsSource: string | null;
  /** Reload memberships + wedding + flags (call after creating/joining a wedding). */
  refresh: (selectWeddingId?: string) => Promise<void>;
};

const WeddingCtx = createContext<Ctx | null>(null);

export function WeddingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [flags, setFlags] = useState<Flags>({});
  const [flagsSource, setFlagsSource] = useState<string | null>(null);
  const weddingIdRef = useRef<string | null>(null);

  const loadFlags = useCallback(async () => {
    const w = weddingIdRef.current;
    if (!w) return;
    try {
      const r = await getFeatures(w);
      setFlags(r.flags);
      setFlagsSource(r.source);
    } catch (e) {
      console.warn('features failed', (e as Error).message);
    }
  }, []);

  const refresh = useCallback(
    async (selectWeddingId?: string) => {
      try {
        const session = await ensureSession();
        setUserId(session.user.id);
        const ms = await getMyMemberships();
        setMemberships(ms);
        let wanted = selectWeddingId ?? (await AsyncStorage.getItem(KEY).catch(() => null)) ?? undefined;
        let m = ms.find((x) => x.wedding_id === wanted) ?? ms[0] ?? null;
        setMember(m);
        if (m) {
          wanted = m.wedding_id;
          weddingIdRef.current = wanted;
          await AsyncStorage.setItem(KEY, wanted).catch(() => undefined);
          setWedding(await getWedding(wanted));
          await loadFlags();
        } else {
          weddingIdRef.current = null;
          setWedding(null);
          setFlags({});
        }
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setReady(true);
      }
    },
    [loadFlags],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Flags change in Flagsmith → the app follows within ~10 s.
  useEffect(() => {
    const t = setInterval(loadFlags, FLAG_POLL_MS);
    return () => clearInterval(t);
  }, [loadFlags]);

  // Keep my own member row and the wedding fresh (role/onboarding changes).
  useLive(['members', 'weddings'], wedding?.id ?? null, () => {
    refresh(weddingIdRef.current ?? undefined);
  });

  const value = useMemo<Ctx>(
    () => ({ ready, error, userId, memberships, member, wedding, flags, flagsSource, refresh }),
    [ready, error, userId, memberships, member, wedding, flags, flagsSource, refresh],
  );
  return <WeddingCtx.Provider value={value}>{children}</WeddingCtx.Provider>;
}

export function useWedding() {
  const c = useContext(WeddingCtx);
  if (!c) throw new Error('useWedding must be used inside WeddingProvider');
  return c;
}

/** Is a Flagsmith feature on for me? (AI features also need the global ai_voice switch.) */
export function useFlag(name: FlagName): boolean {
  const { flags } = useWedding();
  const on = !!flags[name]?.enabled;
  if (name === 'voice_expense' || name === 'ai_task_planner') return on && !!flags.ai_voice?.enabled;
  return on;
}

export function useFlagValue<T>(name: FlagName, fallback: T): T {
  const { flags } = useWedding();
  const v = flags[name]?.value;
  return (v === undefined || v === null ? fallback : (v as T));
}

/**
 * Re-run `onChange` whenever rows of these tables change for this wedding (Supabase Realtime, RLS-filtered).
 * Debounced so a burst of inserts triggers one reload.
 */
export function useLive(tables: string[], weddingId: string | null, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(',');
  useEffect(() => {
    if (!weddingId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 300);
    };
    const ch = supabase.channel(`live-${key}-${weddingId}-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of key.split(',')) {
      const filter = table === 'weddings' ? `id=eq.${weddingId}` : `wedding_id=eq.${weddingId}`;
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, fire);
    }
    ch.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [key, weddingId]);
}
