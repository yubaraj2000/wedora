-- Wedora 0003: security fixes from the pre-launch audit (25 Nov 2026).

-- 1) AI usage quota (per user, counted on the server; only the Edge Function can use it)
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  op text not null,
  cost int not null default 1,
  at timestamptz not null default now()
);
create index if not exists ai_calls_user_at on public.ai_calls (user_id, at desc);
alter table public.ai_calls enable row level security; -- no policies: clients can't read or write it
revoke all on table public.ai_calls from anon, authenticated;

-- Returns true and records the call if the user is under the limits; false otherwise.
create or replace function public.ai_take(p_user uuid, p_op text, p_cost int default 1)
returns boolean language plpgsql security definer set search_path = public as $$
declare per_min int; per_day int; all_day int;
begin
  select coalesce(sum(cost), 0) into per_min from public.ai_calls where user_id = p_user and at > now() - interval '1 minute';
  select coalesce(sum(cost), 0) into per_day from public.ai_calls where user_id = p_user and at > now() - interval '1 day';
  select coalesce(sum(cost), 0) into all_day from public.ai_calls where at > now() - interval '1 day';
  if per_min + p_cost > 40 or per_day + p_cost > 400 or all_day + p_cost > 20000 then
    return false;
  end if;
  insert into public.ai_calls (user_id, op, cost) values (p_user, left(p_op, 30), greatest(p_cost, 1));
  delete from public.ai_calls where at < now() - interval '2 days';
  return true;
end $$;

-- 2) Leave a wedding: anonymise my member row (other rows reference it), drop my notifications.
create or replace function public.leave_wedding(p_wedding uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members;
begin
  m := public.me(p_wedding);
  if m.id is null then raise exception 'not a member'; end if;
  if m.role = 'admin' then raise exception 'the Family Admin cannot leave; the wedding needs an admin'; end if;
  delete from public.notifications where to_member = m.id;
  update public.invites set revoked = true where created_by = m.id and not revoked;
  update public.tasks set assigned_to = null where assigned_to = m.id and status <> 'completed';
  update public.members
     set display_name = 'Former member', role = 'member', department_id = null,
         user_id = gen_random_uuid() -- detach the account; the person no longer sees this wedding
   where id = m.id;
end $$;
-- members.user_id references auth.users; detaching needs that reference relaxed:
alter table public.members drop constraint if exists members_user_id_fkey;

-- 3) Defence in depth: API roles can only READ tables (RLS still filters); all writes go through checked functions.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- Functions: nobody executes by default; grant exactly what the app needs.
revoke execute on function
  public.me(uuid), public.major_of(uuid), public.can_see_dept(uuid, uuid), public.notify(uuid, uuid, text, text, jsonb),
  public.submit_expense_routed(uuid, uuid, int, text, text, text, int, int), public.mark_read(uuid),
  public.create_wedding(text, date, text, text), public.create_minor_department(uuid, text), public.revoke_invite(text),
  public.accept_invite(text, text, text), public.create_task(uuid, text, uuid, date, text), public.update_task_status(uuid, text),
  public.decide_expense(uuid, boolean, text), public.create_invite(uuid, text, int, text, text), public.invite_preview(text),
  public.update_wedding_details(uuid, text, text, date, text, int, text), public.set_events(uuid, jsonb),
  public.complete_onboarding(uuid), public.create_tasks_bulk(uuid, jsonb), public.ai_take(uuid, text, int),
  public.leave_wedding(uuid)
from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- used inside RLS policies (run as the signed-in user)
grant execute on function public.me(uuid), public.major_of(uuid), public.can_see_dept(uuid, uuid) to authenticated;
-- app RPCs
grant execute on function
  public.mark_read(uuid), public.create_wedding(text, date, text, text), public.create_minor_department(uuid, text),
  public.revoke_invite(text), public.accept_invite(text, text, text), public.create_task(uuid, text, uuid, date, text),
  public.update_task_status(uuid, text), public.decide_expense(uuid, boolean, text),
  public.create_invite(uuid, text, int, text, text), public.invite_preview(text),
  public.update_wedding_details(uuid, text, text, date, text, int, text), public.set_events(uuid, jsonb),
  public.complete_onboarding(uuid), public.create_tasks_bulk(uuid, jsonb), public.leave_wedding(uuid)
to authenticated;
-- server-only (Edge Function with the service key)
grant execute on function public.submit_expense_routed(uuid, uuid, int, text, text, text, int, int), public.ai_take(uuid, text, int),
  public.notify(uuid, uuid, text, text, jsonb), public.me(uuid), public.major_of(uuid), public.can_see_dept(uuid, uuid)
to service_role;
