-- Wedora core schema: weddings, departments, members, invites, tasks, expenses, notifications.
-- Rule: clients only READ through RLS. Every write goes through a SECURITY DEFINER function
-- that checks the caller's role, so the hierarchy and approvals are enforced on the server.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wedding_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  parent_id uuid references public.departments(id) on delete cascade, -- null = major department
  is_finance boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  language text not null default 'en-IN' check (language in ('od-IN','hi-IN','bn-IN','en-IN')),
  role text not null check (role in ('admin','head','sub_head','member')),
  department_id uuid references public.departments(id),
  invited_by uuid references public.members(id),
  invite_id uuid,
  joined_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(9), 'hex'),
  department_id uuid not null references public.departments(id) on delete cascade,
  role text not null check (role in ('head','sub_head','member')),
  created_by uuid not null references public.members(id),
  max_uses int not null default 1 check (max_uses between 1 and 50),
  uses int not null default 0,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  title text not null,
  title_i18n jsonb not null default '{}'::jsonb,           -- {"od-IN": "...", "hi-IN": "..."}
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','blocked','cancelled')),
  assigned_to uuid references public.members(id),
  created_by uuid not null references public.members(id),
  source text not null default 'form' check (source in ('form','voice')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  department_id uuid not null references public.departments(id),
  amount int not null check (amount > 0 and amount <= 10000000), -- whole rupees
  description text not null,
  paid_to text,
  submitted_by uuid not null references public.members(id),
  approval_level text not null check (approval_level in ('sub_head','head','finance','admin')),
  approver_id uuid references public.members(id),
  limits_used jsonb not null default '{}'::jsonb,          -- snapshot of Flagsmith limits at submit time
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references public.members(id),
  decided_at timestamptz,
  decision_note text,
  source text not null default 'form' check (source in ('form','voice')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  to_member uuid not null references public.members(id) on delete cascade,
  kind text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.members (user_id);
create index on public.tasks (wedding_id, department_id);
create index on public.expenses (wedding_id, approver_id, status);
create index on public.notifications (to_member, read);

-- ---------- helpers ----------
create or replace function public.me(w uuid) returns public.members
language sql stable security definer set search_path = public as $$
  select * from public.members where wedding_id = w and user_id = auth.uid()
$$;

create or replace function public.major_of(d uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(parent_id, id) from public.departments where id = d
$$;

-- Can the caller see items of department d in wedding w?
create or replace function public.can_see_dept(w uuid, d uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m public.members;
begin
  m := public.me(w);
  if m.id is null then return false; end if;
  if m.role = 'admin' then return true; end if;
  if m.role = 'head' then
    return public.major_of(d) = m.department_id
        or exists (select 1 from public.departments where id = m.department_id and is_finance);
  end if;
  return d = m.department_id;
end $$;

-- ---------- RLS: read-only for clients ----------
alter table public.weddings enable row level security;
alter table public.departments enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;

create policy wed_read on public.weddings for select to authenticated
  using ((public.me(id)).id is not null);
create policy dept_read on public.departments for select to authenticated
  using ((public.me(wedding_id)).id is not null);
create policy mem_read on public.members for select to authenticated
  using ((public.me(wedding_id)).id is not null);
create policy inv_read on public.invites for select to authenticated
  using ((public.me(wedding_id)).role = 'admin' or created_by = (public.me(wedding_id)).id);
create policy task_read on public.tasks for select to authenticated
  using (public.can_see_dept(wedding_id, department_id) or assigned_to = (public.me(wedding_id)).id);
create policy exp_read on public.expenses for select to authenticated
  using (submitted_by = (public.me(wedding_id)).id
      or approver_id = (public.me(wedding_id)).id
      or public.can_see_dept(wedding_id, department_id));
create policy notif_read on public.notifications for select to authenticated
  using (to_member = (public.me(wedding_id)).id);

-- ---------- write functions ----------
create or replace function public.notify(w uuid, to_m uuid, k text, b text, p jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (wedding_id, to_member, kind, body, payload) values (w, to_m, k, b, p)
$$;
revoke all on function public.notify(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.create_wedding(p_name text, p_date date, p_admin_name text, p_language text default 'en-IN')
returns uuid language plpgsql security definer set search_path = public as $$
declare w uuid; d text; i int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.weddings (name, wedding_date, created_by) values (p_name, p_date, auth.uid()) returning id into w;
  foreach d in array array['Finance','Logistics','Food & Catering','Decoration','Guest Management','Events & Ceremony'] loop
    insert into public.departments (wedding_id, name, is_finance, sort) values (w, d, d = 'Finance', i);
    i := i + 1;
  end loop;
  insert into public.members (wedding_id, user_id, display_name, language, role)
    values (w, auth.uid(), p_admin_name, p_language, 'admin');
  return w;
end $$;

create or replace function public.create_minor_department(p_parent uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare dep public.departments; m public.members; nid uuid;
begin
  select * into dep from public.departments where id = p_parent and parent_id is null;
  if dep.id is null then raise exception 'parent must be a major department'; end if;
  m := public.me(dep.wedding_id);
  if not (m.role = 'admin' or (m.role = 'head' and m.department_id = dep.id)) then
    raise exception 'only the admin or this department''s head can add a sub-team';
  end if;
  insert into public.departments (wedding_id, name, parent_id, sort) values (dep.wedding_id, p_name, dep.id, 100)
    returning id into nid;
  return nid;
end $$;

-- You can only invite below you.
create or replace function public.create_invite(p_department uuid, p_role text, p_max_uses int default null)
returns text language plpgsql security definer set search_path = public as $$
declare dep public.departments; m public.members; tok text; uses int;
begin
  select * into dep from public.departments where id = p_department;
  if dep.id is null then raise exception 'unknown department'; end if;
  m := public.me(dep.wedding_id);
  if m.id is null then raise exception 'not a member of this wedding'; end if;
  if p_role = 'head' and (dep.parent_id is not null) then raise exception 'heads lead major departments'; end if;
  if p_role = 'sub_head' and (dep.parent_id is null) then raise exception 'sub-heads lead sub-teams'; end if;

  if m.role = 'admin' then
    null; -- admin may invite any level
  elsif m.role = 'head' then
    if p_role = 'head' or public.major_of(dep.id) <> m.department_id then
      raise exception 'heads invite sub-heads and members of their own department';
    end if;
  elsif m.role = 'sub_head' then
    if p_role <> 'member' or dep.id <> m.department_id then
      raise exception 'sub-heads invite members of their own sub-team';
    end if;
  else
    raise exception 'members cannot invite';
  end if;

  uses := coalesce(p_max_uses, case when p_role = 'member' then 20 else 1 end);
  insert into public.invites (wedding_id, department_id, role, created_by, max_uses)
    values (dep.wedding_id, dep.id, p_role, m.id, least(greatest(uses, 1), 50))
    returning token into tok;
  return tok;
end $$;

create or replace function public.revoke_invite(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invites; m public.members;
begin
  select * into inv from public.invites where token = p_token;
  m := public.me(inv.wedding_id);
  if not (m.role = 'admin' or inv.created_by = m.id) then raise exception 'not allowed'; end if;
  update public.invites set revoked = true where id = inv.id;
end $$;

-- What the join screen shows before someone accepts.
create or replace function public.invite_preview(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wedding', w.name, 'wedding_date', w.wedding_date,
    'department', d.name, 'role', i.role, 'invited_by', m.display_name,
    'valid', (not i.revoked and i.uses < i.max_uses))
  from public.invites i
  join public.weddings w on w.id = i.wedding_id
  join public.departments d on d.id = i.department_id
  join public.members m on m.id = i.created_by
  where i.token = p_token
$$;

create or replace function public.accept_invite(p_token text, p_name text, p_language text default 'en-IN')
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites; existing public.members; inviter public.members; nid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where token = p_token for update;
  if inv.id is null then raise exception 'invite not found'; end if;
  existing := public.me(inv.wedding_id);
  if existing.id is not null then return inv.wedding_id; end if; -- already joined
  if inv.revoked or inv.uses >= inv.max_uses then raise exception 'this invite link is no longer valid'; end if;
  if inv.role = 'head' and exists (select 1 from public.members where department_id = inv.department_id and role = 'head') then
    raise exception 'this department already has a head';
  end if;

  insert into public.members (wedding_id, user_id, display_name, language, role, department_id, invited_by, invite_id)
    values (inv.wedding_id, auth.uid(), left(trim(p_name), 60), p_language, inv.role, inv.department_id, inv.created_by, inv.id)
    returning id into nid;
  update public.invites set uses = uses + 1 where id = inv.id;

  select * into inviter from public.members where id = inv.created_by;
  perform public.notify(inv.wedding_id, inviter.id, 'joined', left(trim(p_name), 60) || ' joined via your invite', jsonb_build_object('member_id', nid));
  return inv.wedding_id;
end $$;

-- Tasks: admin, heads (own major dept + sub-teams) and sub-heads (own sub-team) create tasks.
create or replace function public.create_task(p_department uuid, p_title text, p_assigned_to uuid default null,
                                              p_due date default null, p_source text default 'form')
returns uuid language plpgsql security definer set search_path = public as $$
declare dep public.departments; m public.members; tid uuid; ok boolean;
begin
  select * into dep from public.departments where id = p_department;
  m := public.me(dep.wedding_id);
  ok := m.role = 'admin'
     or (m.role = 'head' and public.major_of(dep.id) = m.department_id)
     or (m.role = 'sub_head' and dep.id = m.department_id);
  if not coalesce(ok, false) then raise exception 'you cannot create tasks for this department'; end if;
  insert into public.tasks (wedding_id, department_id, title, assigned_to, created_by, due_date, source)
    values (dep.wedding_id, dep.id, left(trim(p_title), 200), p_assigned_to, m.id, p_due, p_source)
    returning id into tid;
  if p_assigned_to is not null and p_assigned_to <> m.id then
    perform public.notify(dep.wedding_id, p_assigned_to, 'task_assigned', 'New task: ' || left(trim(p_title), 200), jsonb_build_object('task_id', tid));
  end if;
  return tid;
end $$;

create or replace function public.update_task_status(p_task uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks; m public.members;
begin
  select * into t from public.tasks where id = p_task;
  m := public.me(t.wedding_id);
  if m.id is null then raise exception 'not a member'; end if;
  if not (t.assigned_to = m.id or (m.role <> 'member' and public.can_see_dept(t.wedding_id, t.department_id))) then
    raise exception 'you cannot change this task';
  end if;
  update public.tasks set status = p_status, updated_at = now() where id = t.id;
  if t.created_by <> m.id then
    perform public.notify(t.wedding_id, t.created_by, 'task_status', m.display_name || ' set "' || t.title || '" to ' || p_status, jsonb_build_object('task_id', t.id));
  end if;
end $$;

-- Expenses are submitted by the submit-expense Edge Function, which reads the approval limits
-- from Flagsmith on the server and calls this. Clients cannot call it.
create or replace function public.submit_expense_routed(p_user uuid, p_wedding uuid, p_amount int, p_description text,
                                                       p_paid_to text, p_source text, p_sub_limit int, p_head_limit int)
returns public.expenses language plpgsql security definer set search_path = public as $$
declare m public.members; dept uuid; major uuid; lvl text; appr uuid; e public.expenses;
begin
  select * into m from public.members where wedding_id = p_wedding and user_id = p_user;
  if m.id is null then raise exception 'not a member of this wedding'; end if;
  dept := coalesce(m.department_id, (select id from public.departments where wedding_id = p_wedding and is_finance));
  major := public.major_of(dept);

  lvl := case when p_amount <= p_sub_limit then 'sub_head' when p_amount <= p_head_limit then 'head' else 'finance' end;

  -- resolve the approver, escalating when a level is empty or is the submitter
  if lvl = 'sub_head' then
    select id into appr from public.members where department_id = dept and role = 'sub_head' and id <> m.id limit 1;
    if appr is null then lvl := 'head'; end if;
  end if;
  if lvl = 'head' then
    select id into appr from public.members where department_id = major and role = 'head' and id <> m.id limit 1;
    if appr is null then lvl := 'finance'; end if;
  end if;
  if lvl = 'finance' then
    select mm.id into appr from public.members mm join public.departments d on d.id = mm.department_id
      where d.wedding_id = p_wedding and d.is_finance and mm.role = 'head' and mm.id <> m.id limit 1;
    if appr is null then lvl := 'admin'; end if;
  end if;
  if lvl = 'admin' then
    select id into appr from public.members where wedding_id = p_wedding and role = 'admin' limit 1;
  end if;

  insert into public.expenses (wedding_id, department_id, amount, description, paid_to, submitted_by,
                               approval_level, approver_id, limits_used, source)
    values (p_wedding, dept, p_amount, left(trim(p_description), 300), left(trim(p_paid_to), 120), m.id,
            lvl, appr, jsonb_build_object('sub_head', p_sub_limit, 'head', p_head_limit), coalesce(p_source, 'form'))
    returning * into e;

  if appr is not null and appr <> m.id then
    perform public.notify(p_wedding, appr, 'expense_pending',
      m.display_name || ' submitted ₹' || p_amount || ' — ' || left(trim(p_description), 80), jsonb_build_object('expense_id', e.id));
  end if;
  return e;
end $$;
revoke all on function public.submit_expense_routed(uuid, uuid, int, text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.submit_expense_routed(uuid, uuid, int, text, text, text, int, int) to service_role;

create or replace function public.decide_expense(p_expense uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.expenses; m public.members;
begin
  select * into e from public.expenses where id = p_expense for update;
  m := public.me(e.wedding_id);
  if m.id is null or not (e.approver_id = m.id or m.role = 'admin') then
    raise exception 'only the assigned approver can decide this expense';
  end if;
  if e.submitted_by = m.id then raise exception 'you cannot approve your own expense'; end if;
  if e.status <> 'pending' then raise exception 'already decided'; end if;
  update public.expenses
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = m.id, decided_at = now(), decision_note = p_note
   where id = e.id;
  perform public.notify(e.wedding_id, e.submitted_by, 'expense_decided',
    '₹' || e.amount || ' ' || case when p_approve then 'approved' else 'rejected' end || ' by ' || m.display_name,
    jsonb_build_object('expense_id', e.id));
end $$;

create or replace function public.mark_read(p_wedding uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read = true where to_member = (public.me(p_wedding)).id and not read
$$;

-- ---------- grants for client-callable functions ----------
grant execute on function public.create_wedding(text, date, text, text) to authenticated;
grant execute on function public.create_minor_department(uuid, text) to authenticated;
grant execute on function public.create_invite(uuid, text, int) to authenticated;
grant execute on function public.revoke_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to authenticated, anon;
grant execute on function public.accept_invite(text, text, text) to authenticated;
grant execute on function public.create_task(uuid, text, uuid, date, text) to authenticated;
grant execute on function public.update_task_status(uuid, text) to authenticated;
grant execute on function public.decide_expense(uuid, boolean, text) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;

-- ---------- realtime ----------
alter publication supabase_realtime add table public.members, public.invites, public.tasks, public.expenses, public.notifications;
