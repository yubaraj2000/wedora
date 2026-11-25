export type Lang = 'od-IN' | 'hi-IN' | 'bn-IN' | 'en-IN';
export type Role = 'admin' | 'head' | 'sub_head' | 'member';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export type Wedding = {
  id: string;
  name: string;
  wedding_date: string | null;
  bride_name: string | null;
  groom_name: string | null;
  city: string | null;
  budget: number | null;
  language: Lang;
  onboarding_done: boolean;
};

export type Department = {
  id: string;
  wedding_id: string;
  name: string;
  parent_id: string | null;
  is_finance: boolean;
  sort: number;
};

export type Member = {
  id: string;
  wedding_id: string;
  user_id: string;
  display_name: string;
  language: Lang;
  role: Role;
  department_id: string | null;
  invited_by: string | null;
  invite_id: string | null;
  joined_at: string;
  onboarding_done: boolean;
};

export type Invite = {
  id: string;
  wedding_id: string;
  token: string;
  department_id: string;
  role: Exclude<Role, 'admin'>;
  created_by: string;
  max_uses: number;
  uses: number;
  revoked: boolean;
  invitee_name: string | null;
  invitee_phone: string | null;
  created_at: string;
};

export type WeddingEvent = {
  id: string;
  wedding_id: string;
  key: string;
  name: string;
  local_name: string | null;
  event_date: string | null;
  sort: number;
};

export type Task = {
  id: string;
  wedding_id: string;
  department_id: string;
  title: string;
  title_i18n: Partial<Record<Lang, string>>;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string;
  source: 'form' | 'voice';
  event_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  wedding_id: string;
  department_id: string;
  amount: number;
  description: string;
  paid_to: string | null;
  submitted_by: string;
  approval_level: 'sub_head' | 'head' | 'finance' | 'admin';
  approver_id: string | null;
  limits_used: { sub_head?: number; head?: number };
  status: ExpenseStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  source: 'form' | 'voice';
  created_at: string;
};

export type Notification = {
  id: string;
  wedding_id: string;
  to_member: string;
  kind: string;
  body: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

export type Flag = { enabled: boolean; value: unknown };
export type FlagName =
  | 'approval_limits'
  | 'ai_voice'
  | 'sarvam_model'
  | 'budget_dashboard'
  | 'ai_task_planner'
  | 'voice_expense'
  | 'invite_people'
  | 'onboarding_mode'
  | 'ceremony_suggestions';
export type Flags = Partial<Record<FlagName, Flag>>;

export type Ceremony = { key: string; en: string; local: string; note?: string };

export type InvitePreview = {
  wedding: string;
  wedding_date: string | null;
  wedding_language: Lang;
  department: string;
  department_id: string;
  role: Exclude<Role, 'admin'>;
  invited_by: string;
  invitee_name: string | null;
  valid: boolean;
};

export type SuggestedTask = { department_id: string; department: string; title: string; event_key: string; local: string };

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Family Admin',
  head: 'Head',
  sub_head: 'Sub-head',
  member: 'Member',
};
