// Every call the app makes. Reads go through RLS; writes go through checked RPCs or the wedora Edge Function.
import { supabase } from './supabase';
import type {
  Ceremony,
  Department,
  Expense,
  Flags,
  Invite,
  InvitePreview,
  Lang,
  Member,
  Notification,
  Role,
  SuggestedTask,
  Task,
  TaskStatus,
  Wedding,
  WeddingEvent,
} from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Call the wedora Edge Function. Throws with the server's message on error. */
export async function fn<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('wedora', { body: { op, ...body } });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') msg = (await ctx.json()).error ?? msg;
    } catch {
      /* keep generic message */
    }
    throw new Error(msg);
  }
  return data as T;
}

// ---------- reads ----------
export const getMyMemberships = async () =>
  check<Member[]>(
    await supabase
      .from('members')
      .select('*')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .order('joined_at', { ascending: false }),
  );
export const getWedding = async (id: string) => check<Wedding>(await supabase.from('weddings').select('*').eq('id', id).single());
export const getDepartments = async (w: string) =>
  check<Department[]>(await supabase.from('departments').select('*').eq('wedding_id', w).order('sort'));
export const getMembers = async (w: string) =>
  check<Member[]>(await supabase.from('members').select('*').eq('wedding_id', w).order('joined_at'));
export const getInvites = async (w: string) =>
  check<Invite[]>(await supabase.from('invites').select('*').eq('wedding_id', w).order('created_at', { ascending: false }));
export const getEvents = async (w: string) =>
  check<WeddingEvent[]>(await supabase.from('events').select('*').eq('wedding_id', w).order('sort'));
export const getTasks = async (w: string) =>
  check<Task[]>(await supabase.from('tasks').select('*').eq('wedding_id', w).order('created_at', { ascending: false }));
export const getExpenses = async (w: string) =>
  check<Expense[]>(await supabase.from('expenses').select('*').eq('wedding_id', w).order('created_at', { ascending: false }));
export const getNotifications = async (w: string) =>
  check<Notification[]>(
    await supabase.from('notifications').select('*').eq('wedding_id', w).order('created_at', { ascending: false }).limit(50),
  );

// ---------- writes (RPC, permission-checked in Postgres) ----------
export const createWedding = async (name: string, date: string | null, adminName: string, lang: Lang) =>
  check<string>(await supabase.rpc('create_wedding', { p_name: name, p_date: date, p_admin_name: adminName, p_language: lang }));

export const updateWeddingDetails = async (
  w: string,
  d: { bride?: string | null; groom?: string | null; date?: string | null; city?: string | null; budget?: number | null; lang?: Lang | null },
) =>
  check(
    await supabase.rpc('update_wedding_details', {
      p_wedding: w,
      p_bride: d.bride ?? null,
      p_groom: d.groom ?? null,
      p_date: d.date || null,
      p_city: d.city ?? null,
      p_budget: d.budget ?? null,
      p_language: d.lang ?? null,
    }),
  );

export const setEvents = async (w: string, events: (Ceremony & { date?: string })[]) =>
  check<number>(await supabase.rpc('set_events', { p_wedding: w, p_events: events }));

export const createTasksBulk = async (w: string, tasks: { department_id: string; title: string; event_key?: string }[]) =>
  check<number>(await supabase.rpc('create_tasks_bulk', { p_wedding: w, p_tasks: tasks }));

export const createTask = async (departmentId: string, title: string, assignedTo?: string | null, source: 'form' | 'voice' = 'form') =>
  check<string>(
    await supabase.rpc('create_task', { p_department: departmentId, p_title: title, p_assigned_to: assignedTo ?? null, p_due: null, p_source: source }),
  );

export const updateTaskStatus = async (taskId: string, status: TaskStatus) =>
  check(await supabase.rpc('update_task_status', { p_task: taskId, p_status: status }));

export const createMinorDepartment = async (parentId: string, name: string) =>
  check<string>(await supabase.rpc('create_minor_department', { p_parent: parentId, p_name: name }));

export const createInvite = async (
  departmentId: string,
  role: Exclude<Role, 'admin'>,
  opts: { maxUses?: number; name?: string; phone?: string } = {},
) =>
  check<string>(
    await supabase.rpc('create_invite', {
      p_department: departmentId,
      p_role: role,
      p_max_uses: opts.maxUses ?? null,
      p_invitee_name: opts.name ?? null,
      p_invitee_phone: opts.phone ?? null,
    }),
  );

export const revokeInvite = async (token: string) => check(await supabase.rpc('revoke_invite', { p_token: token }));
export const invitePreview = async (token: string) =>
  check<InvitePreview | null>(await supabase.rpc('invite_preview', { p_token: token }));
export const acceptInvite = async (token: string, name: string, lang: Lang) =>
  check<string>(await supabase.rpc('accept_invite', { p_token: token, p_name: name, p_language: lang }));
export const decideExpense = async (expenseId: string, approve: boolean, note?: string) =>
  check(await supabase.rpc('decide_expense', { p_expense: expenseId, p_approve: approve, p_note: note ?? null }));
export const completeOnboarding = async (w: string) => check(await supabase.rpc('complete_onboarding', { p_wedding: w }));
export const markRead = async (w: string) => check(await supabase.rpc('mark_read', { p_wedding: w }));

// ---------- server function (Flagsmith + Sarvam) ----------
export const getFeatures = (w: string) => fn<{ flags: Flags; source: string; role: Role }>('features', { wedding_id: w });

export const submitExpense = (
  w: string,
  e: { amount: number | string; description: string; paid_to?: string; source?: 'form' | 'voice' },
) => fn<{ expense: Expense; limits: { sub_head: number; head: number }; flags_source: string }>('submit_expense', { wedding_id: w, ...e });

/** Translate English lines into the user's language (returns the same lines for English). */
export const say = async (lang: Lang, texts: string[]) =>
  lang === 'en-IN' ? texts : (await fn<{ texts: string[] }>('say', { lang, texts })).texts;

export const parseWedding = (text: string) =>
  fn<{ bride: string; groom: string; date: string; city: string; admin_name: string }>('parse_wedding', { text });
export const parseBudget = (text: string) => fn<{ budget: number | null; via: string }>('parse_budget', { text });
export const suggestTasks = (
  w: string,
  events: { key: string; en: string }[],
  departments: { id: string; name: string }[],
  lang: Lang,
) => fn<{ tasks: SuggestedTask[] }>('suggest_tasks', { wedding_id: w, events, departments, lang });
