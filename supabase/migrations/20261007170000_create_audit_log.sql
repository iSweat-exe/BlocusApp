-- A-039: audit log of administrative actions (who did what, to whom, when).
-- Rows are written only by SECURITY DEFINER functions; clients can read them with audit.read.

create table public.audit_logs (
  id bigint generated always as identity primary key,
  -- Plain ids (no foreign key) so the history survives the deletion of an account.
  actor_id uuid,
  action text not null
    constraint audit_logs_action_format check (action ~ '^[a-z_]+\.[a-z_.]+$'),
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Append-only log of administrative actions, written by RPCs only.';

-- Newest first (keyset pagination), plus lookups by actor and by target.
create index audit_logs_feed_idx on public.audit_logs (created_at desc, id desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_target_idx on public.audit_logs (target_id);

-- Appends an entry for the current user. Internal: only other SECURITY DEFINER functions call it.
create function public.write_audit(p_action text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_id, details)
  values ((select auth.uid()), p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;

revoke execute on function public.write_audit(text, uuid, jsonb) from public, anon, authenticated;

-- Permission to read the log.
insert into public.permissions (key, description) values
  ('audit.read', 'Read the audit log of administrative actions');
insert into public.role_permissions (role, permission) values ('admin', 'audit.read');

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create policy "audit_logs_select_auditors" on public.audit_logs
  for select to authenticated
  using ((select public.has_permission((select auth.uid()), 'audit.read')));

-- No insert/update/delete policy: the log is append-only through write_audit().

-- assign_role() now records every role change (same rules as before).
create or replace function public.assign_role(p_target uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_rank int;
  target_rank int;
  new_rank int;
  old_role text;
begin
  if caller is null or not public.has_permission(caller, 'role.assign') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_target = caller then
    raise exception 'hierarchy_violation' using errcode = '42501', detail = 'cannot change own role';
  end if;

  new_rank := public.role_rank(p_role);
  if new_rank is null then
    raise exception 'unknown_role' using errcode = '22023';
  end if;

  select public.role_rank(p.role) into caller_rank from public.profiles p where p.id = caller;
  select public.role_rank(p.role), p.role into target_rank, old_role from public.profiles p where p.id = p_target;
  if target_rank is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;

  if caller_rank is null or target_rank >= caller_rank or new_rank >= caller_rank then
    raise exception 'hierarchy_violation' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_target;
  perform public.write_audit('role.assigned', p_target, jsonb_build_object('from', old_role, 'to', p_role));
end;
$$;
