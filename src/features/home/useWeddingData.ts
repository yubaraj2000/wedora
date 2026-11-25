import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDepartments, getExpenses, getInvites, getMembers, getNotifications, getTasks } from '@/lib/api';
import type { Department, Expense, Invite, Member, Notification, Task } from '@/lib/types';
import { useLive, useWedding } from '@/lib/wedding';

import { byId } from './logic';

type Part = 'departments' | 'members' | 'tasks' | 'expenses' | 'notifications' | 'invites';

const LIVE: Record<Part, string> = {
  departments: 'departments',
  members: 'members',
  tasks: 'tasks',
  expenses: 'expenses',
  notifications: 'notifications',
  invites: 'invites',
};

/** Loads the wedding's rows (RLS-filtered) and keeps them fresh with Supabase Realtime. */
export function useWeddingData(parts: Part[]) {
  const { wedding } = useWedding();
  const w = wedding?.id ?? null;
  const key = parts.join(',');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!w) return;
    const want = new Set(key.split(','));
    try {
      const [d, m, t, e, n, i] = await Promise.all([
        want.has('departments') ? getDepartments(w) : null,
        want.has('members') ? getMembers(w) : null,
        want.has('tasks') ? getTasks(w) : null,
        want.has('expenses') ? getExpenses(w) : null,
        want.has('notifications') ? getNotifications(w) : null,
        want.has('invites') ? getInvites(w) : null,
      ]);
      if (d) setDepartments(d);
      if (m) setMembers(m);
      if (t) setTasks(t);
      if (e) setExpenses(e);
      if (n) setNotifications(n);
      if (i) setInvites(i);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [w, key]);

  useEffect(() => {
    load();
  }, [load]);

  useLive(
    parts.map((p) => LIVE[p]),
    w,
    load,
  );

  const membersById = useMemo(() => byId(members), [members]);
  const deptsById = useMemo(() => byId(departments), [departments]);

  return {
    departments,
    members,
    tasks,
    expenses,
    notifications,
    invites,
    membersById,
    deptsById,
    loading,
    error,
    reload: load,
  };
}
