-- Wedora 0002: AI onboarding — wedding details, events (ceremonies), named invites, bulk tasks.

alter table public.weddings
  add column if not exists bride_name text,
  add column if not exists groom_name text,
  add column if not exists city text,
  add column if not exists budget int check (budget is null or (budget >= 0 and budget <= 1000000000)),
  add column if not exists language text not null default 'en-IN',
  add column if not exists onboarding_done boolean not null default false;

alter table public.members
  add column if not exists onboarding_done boolean not null default false;

alter table public.invites
  add column if not exists invitee_name text,
  add column if not exists invitee_phone text;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  key text not null,
  name text not null,
  local_name text,
  event_date date,
  sort int not null default 0,
  unique (wedding_id, key)
);
alter table public.events enable row level security;
create policy events_read on public.events for select to authenticated
  using ((public.me(wedding_id)).id is not null);

alter table public.tasks add column if not exists event_id uuid references public.events(id) on delete set null;

-- Admin saves what the AI understood (after the admin confirms it on screen).
create or replace function public.update_wedding_details(p_wedding uuid, p_bride text, p_groom text, p_date date,
                                                         p_city text, p_budget int, p_language text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (public.me(p_wedding)).role is distinct from 'admin' then raise exception 'only the admin can change wedding details'; end if;
  update public.weddings set
    bride_name = coalesce(left(trim(p_bride), 60), bride_name),
    groom_name = coalesce(left(trim(p_groom), 60), groom_name),
    wedding_date = coalesce(p_date, wedding_date),
    city = coalesce(left(trim(p_city), 60), city),
    budget = coalesce(p_budget, budget),
    language = coalesce(p_language, language),
    name = case when p_bride is not null and p_groom is not null
                then left(trim(p_bride) || ' & ' || trim(p_groom), 120) else name end
  where id = p_wedding;
end $$;

-- Replace the wedding's ceremony list: [{key, en, local, date?}]
create or replace function public.set_events(p_wedding uuid, p_events jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare e jsonb; i int := 0;
begin
  if (public.me(p_wedding)).role is distinct from 'admin' then raise exception 'only the admin can set ceremonies'; end if;
  delete from public.events where wedding_id = p_wedding
    and key not in (select x->>'key' from jsonb_array_elements(p_events) x);
  for e in select * from jsonb_array_elements(p_events) loop
    insert into public.events (wedding_id, key, name, local_name, event_date, sort)
      values (p_wedding, left(e->>'key', 60), left(e->>'en', 80), left(e->>'local', 80), nullif(e->>'date','')::date, i)
      on conflict (wedding_id, key) do update set name = excluded.name, local_name = excluded.local_name, sort = excluded.sort;
    i := i + 1;
  end loop;
  return i;
end $$;

-- Create many tasks at once: [{department_id, title, event_key?}]. Same permission rule as create_task.
create or replace function public.create_tasks_bulk(p_wedding uuid, p_tasks jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare t jsonb; m public.members; dep public.departments; ev uuid; n int := 0;
begin
  m := public.me(p_wedding);
  if m.id is null then raise exception 'not a member'; end if;
  for t in select * from jsonb_array_elements(p_tasks) loop
    select * into dep from public.departments where id = (t->>'department_id')::uuid and wedding_id = p_wedding;
    if dep.id is null then continue; end if;
    if not (m.role = 'admin'
         or (m.role = 'head' and public.major_of(dep.id) = m.department_id)
         or (m.role = 'sub_head' and dep.id = m.department_id)) then
      raise exception 'you cannot create tasks for %', dep.name;
    end if;
    select id into ev from public.events where wedding_id = p_wedding and key = t->>'event_key';
    insert into public.tasks (wedding_id, department_id, title, created_by, event_id, source)
      values (p_wedding, dep.id, left(trim(t->>'title'), 200), m.id, ev, 'form');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Invites now carry the invitee's name and phone (only the admin and the inviter can read them).
drop function if exists public.create_invite(uuid, text, int);
create or replace function public.create_invite(p_department uuid, p_role text, p_max_uses int default null,
                                                p_invitee_name text default null, p_invitee_phone text default null)
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
    null;
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

  uses := coalesce(p_max_uses, case when p_role = 'member' and p_invitee_name is null then 20 else 1 end);
  insert into public.invites (wedding_id, department_id, role, created_by, max_uses, invitee_name, invitee_phone)
    values (dep.wedding_id, dep.id, p_role, m.id, least(greatest(uses, 1), 50),
            left(trim(p_invitee_name), 60), left(regexp_replace(coalesce(p_invitee_phone, ''), '[^0-9+]', '', 'g'), 20))
    returning token into tok;
  return tok;
end $$;
grant execute on function public.create_invite(uuid, text, int, text, text) to authenticated;

create or replace function public.invite_preview(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wedding', w.name, 'wedding_date', w.wedding_date, 'wedding_language', w.language,
    'department', d.name, 'department_id', d.id, 'role', i.role, 'invited_by', m.display_name,
    'invitee_name', i.invitee_name,
    'valid', (not i.revoked and i.uses < i.max_uses))
  from public.invites i
  join public.weddings w on w.id = i.wedding_id
  join public.departments d on d.id = i.department_id
  join public.members m on m.id = i.created_by
  where i.token = p_token
$$;

create or replace function public.complete_onboarding(p_wedding uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members;
begin
  m := public.me(p_wedding);
  if m.id is null then raise exception 'not a member'; end if;
  update public.members set onboarding_done = true where id = m.id;
  if m.role = 'admin' then update public.weddings set onboarding_done = true where id = p_wedding; end if;
end $$;

grant execute on function public.update_wedding_details(uuid, text, text, date, text, int, text) to authenticated;
grant execute on function public.set_events(uuid, jsonb) to authenticated;
grant execute on function public.create_tasks_bulk(uuid, jsonb) to authenticated;
grant execute on function public.complete_onboarding(uuid) to authenticated;

alter publication supabase_realtime add table public.events, public.weddings;
