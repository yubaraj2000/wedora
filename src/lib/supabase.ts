import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env');
}

/**
 * Phones keep the session in the Android Keystore / iOS Keychain (expo-secure-store), not plain storage.
 * SecureStore values are limited to ~2 KB, so the session is split into chunks.
 */
const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');
const secureStorage: SupportedStorage = {
  async getItem(k) {
    const base = safeKey(k);
    const n = Number(await SecureStore.getItemAsync(`${base}.n`));
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${base}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(k, value) {
    const base = safeKey(k);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${base}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${base}.n`, String(n));
  },
  async removeItem(k) {
    const base = safeKey(k);
    const n = Number(await SecureStore.getItemAsync(`${base}.n`));
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${base}.${i}`);
    await SecureStore.deleteItemAsync(`${base}.n`);
  },
};

export const supabase = createClient(url, key, {
  auth: {
    // Web uses the browser's localStorage (the default); phones use the secure store above.
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Make sure this device has a session. Relatives never type email or password. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.session!;
}
