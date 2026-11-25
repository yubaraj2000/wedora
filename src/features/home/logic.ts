// Pure helpers shared by home / admin / team screens. They mirror the server-side rules for the UI.
import { formatINR } from '@/components/ui';
import type { Department, Expense, Member, Role, Task } from '@/lib/types';

export type ById<T> = Record<string, T>;

export function byId<T extends { id: string }>(rows: T[]): ById<T> {
  const out: ById<T> = {};
  for (const r of rows) out[r.id] = r;
  return out;
}

export const LEVEL_LABEL: Record<string, string> = {
  admin: 'Admin',
  head: 'Head',
  sub_head: 'Sub-head',
  member: 'Member',
  finance: 'Finance',
};

export const isLeader = (m: Member | null | undefined) => !!m && m.role !== 'member';

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Department ids this member leads/belongs to, including sub-teams for a head. */
export function myDeptScope(m: Member, depts: Department[]): Set<string> {
  const s = new Set<string>();
  if (!m.department_id) return s;
  s.add(m.department_id);
  if (m.role === 'head') for (const d of depts) if (d.parent_id === m.department_id) s.add(d.id);
  return s;
}

/** Departments where a leader may create tasks. */
export function taskDepartments(m: Member, depts: Department[]): Department[] {
  if (m.role === 'admin') return depts;
  if (m.role === 'member') return [];
  const scope = myDeptScope(m, depts);
  return depts.filter((d) => scope.has(d.id));
}

export function canChangeTask(m: Member, t: Task, depts: Department[]): boolean {
  if (m.role === 'admin' || t.assigned_to === m.id) return true;
  return isLeader(m) && myDeptScope(m, depts).has(t.department_id);
}

export function canDecide(m: Member, e: Expense): boolean {
  if (e.status !== 'pending' || e.submitted_by === m.id) return false;
  return e.approver_id === m.id || m.role === 'admin';
}

/**
 * Why did this expense go to its approver? e.g.
 * "₹12,000 > ₹5,000 sub-head limit → Head (limits from Flagsmith)"
 */
export function routeReason(e: Expense, members: ById<Member>): string {
  const sub = e.limits_used?.sub_head;
  const head = e.limits_used?.head;
  const amt = formatINR(Number(e.amount));
  const who = e.approver_id ? members[e.approver_id]?.display_name : null;
  const to = `${LEVEL_LABEL[e.approval_level] ?? e.approval_level}${who ? ` (${who})` : ''}`;
  let why: string;
  if (e.approval_level === 'sub_head' && sub != null) why = `${amt} ≤ ${formatINR(sub)} sub-head limit`;
  else if (e.approval_level === 'head' && sub != null) why = `${amt} > ${formatINR(sub)} sub-head limit`;
  else if ((e.approval_level === 'finance' || e.approval_level === 'admin') && head != null)
    why = `${amt} > ${formatINR(head)} head limit`;
  else why = amt;
  return `${why} → ${to} (limits from Flagsmith)`;
}

export const TASK_NEXT: Record<Task['status'], Task['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
  blocked: 'in_progress',
  cancelled: 'pending',
};

export function taskTitle(t: Task, m: Member | null): string {
  return (m && t.title_i18n?.[m.language]) || t.title;
}

// ---------- invites ----------
export type InviteRole = Exclude<Role, 'admin'>;

/** Departments I may invite into (any level). */
export function inviteDepartments(m: Member, depts: Department[]): Department[] {
  if (m.role === 'admin') return depts;
  if (m.role === 'member' || !m.department_id) return [];
  return depts.filter((d) => myDeptScope(m, depts).has(d.id));
}

/** Levels I may invite into this department. */
export function inviteRoles(m: Member, d: Department | undefined): InviteRole[] {
  if (!d) return [];
  const major = d.parent_id === null;
  if (m.role === 'admin') return major ? ['head', 'member'] : ['sub_head', 'member'];
  if (m.role === 'head') return major ? ['member'] : ['sub_head', 'member'];
  if (m.role === 'sub_head') return d.id === m.department_id ? ['member'] : [];
  return [];
}
