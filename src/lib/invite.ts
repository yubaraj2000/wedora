import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type { Role } from './types';

/** Public link for an invite. Uses EXPO_PUBLIC_WEB_URL (deployed web app) when set. */
export function inviteUrl(token: string): string {
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  if (base) return `${base.replace(/\/$/, '')}/join/${token}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/join/${token}`;
  return Linking.createURL(`/join/${token}`);
}

/** Digits only, with 91 prefixed for 10-digit Indian mobile numbers (for wa.me). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function whatsappUrl(phone: string | null | undefined, message: string): string {
  const p = phone ? normalizePhone(phone) : '';
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(phone: string | null | undefined, message: string) {
  const url = whatsappUrl(phone, message);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank');
    return;
  }
  await Linking.openURL(url);
}

export function inviteMessage(opts: { name?: string | null; wedding: string; department: string; role: Role; inviter: string; url: string }) {
  const level = opts.role === 'head' ? 'head' : opts.role === 'sub_head' ? 'sub-head' : 'member';
  return (
    `Namaste${opts.name ? ' ' + opts.name : ''}! ${opts.inviter} has invited you to join ${opts.wedding} on Wedora ` +
    `as ${level} of ${opts.department}. Tap to join (you can use Odia, Hindi, Bengali or English): ${opts.url}`
  );
}

export type PickedContact = { name: string; phone: string };

/** Pick one contact from the phone. Returns null on web, on denial, or if nothing was picked. */
export async function pickContact(): Promise<PickedContact | null> {
  if (Platform.OS === 'web') return null;
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return null;
  const c = await Contacts.presentContactPickerAsync();
  if (!c) return null;
  const phone = c.phoneNumbers?.[0]?.number ?? '';
  return { name: c.name ?? [c.firstName, c.lastName].filter(Boolean).join(' '), phone };
}

export const canPickContacts = Platform.OS !== 'web';
