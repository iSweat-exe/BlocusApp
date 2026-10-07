-- A-035 / A-036: editable role x permission matrix and per-user overrides.
-- One source of truth, effective_permissions(), feeds both has_permission() (RLS) and the JWT claims.

insert into public.permissions (key, description) values
  ('permission.manage', 'Edit role permissions and per-user permission overrides');
insert into public.role_permissions (role, permission) values ('admin', 'permission.manage');

create table public.permission_overrides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null references public.permissions (key) on update cascade on delete cascade,
  effect text not null constraint permission_overrides_effect check (effect in ('grant', 'deny')),
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

comment on table public.permission_overrides is 'Per-user permission grants/denies on top of the role. Deny wins.';

create index permission_overrides_permission_idx on public.permission_overrides (permission);

-- Permissions of a user: role permissions + grants - denies. super_admin always holds every
-- catalogued permission and ignores overrides. Internal: only SECURITY DEFINER functions call it.
create function public.effective_permissions(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.key order by x.key), '{}'::text[])
  from (
    select pe.key
      from public.permissions pe
      join public.profiles p on p.id = p_user_id and p.role = 'super_admin'
    union
    select rp.permission
      from public.role_permissions rp
      join public.profiles p on p.id = p_user_id and p.role = rp.role and p.role <> 'super_admin'
    union
    select o.permission
      from public.permission_overrides o
      join public.profiles p on p.id = o.user_id and p.role <> 'super_admin'
     where o.user_id = p_user_id and o.effect = 'grant'
  ) x
  where not exists (
    select 1
      from public.permission_overrides d
      join public.profiles p on p.id = d.user_id and p.role <> 'super_admin'
     where d.user_id = p_user_id and d.effect = 'deny' and d.permission = x.key
  );
$$;

revoke execute on function public.effective_permissions(uuid) from public, anon, authenticated;

-- has_permission() and the JWT hook now share effective_permissions().
create or replace function public.has_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_permission = any (public.effective_permissions(p_user_id));
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  uid uuid := (event ->> 'user_id')::uuid;
  user_role text;
begin
  claims := event -> 'claims';

  select p.role into user_role from public.profiles p where p.id = uid;
  if user_role is null then
    return event;
  end if;

  -- "role" is reserved by Postgres/PostgREST, so the application role gets its own claim.
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{permissions}', to_jsonb(public.effective_permissions(uid)));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grants or revokes a permission for a whole role. The caller needs permission.manage, may only edit
-- roles ranking strictly below their own, and may only grant permissions they hold themselves.
create function public.set_role_permission(p_role text, p_permission text, p_granted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_rank int;
  edited_rank int;
  changed int;
begin
  if caller is null or not public.has_permission(caller, 'permission.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  edited_rank := public.role_rank(p_role);
  if edited_rank is null then
    raise exception 'unknown_role' using errcode = '22023';
  end if;
  if not exists (select 1 from public.permissions where key = p_permission) then
    raise exception 'unknown_permission' using errcode = '22023';
  end if;

  select public.role_rank(p.role) into caller_rank from public.profiles p where p.id = caller;
  if caller_rank is null or edited_rank >= caller_rank then
    raise exception 'hierarchy_violation' using errcode = '42501';
  end if;
  if p_granted and not public.has_permission(caller, p_permission) then
    raise exception 'privilege_escalation' using errcode = '42501';
  end if;

  if p_granted then
    insert into public.role_permissions (role, permission) values (p_role, p_permission)
    on conflict do nothing;
  else
    delete from public.role_permissions where role = p_role and permission = p_permission;
  end if;
  get diagnostics changed = row_count;

  if changed > 0 then
    perform public.write_audit(
      case when p_granted then 'role_permission.granted' else 'role_permission.revoked' end,
      null,
      jsonb_build_object('role', p_role, 'permission', p_permission)
    );
  end if;
end;
$$;

revoke execute on function public.set_role_permission(text, text, boolean) from public, anon;
grant execute on function public.set_role_permission(text, text, boolean) to authenticated;

-- Sets (grant/deny) or clears (null) a permission override for one user. Same rules as above, applied
-- to a user ranking strictly below the caller (never the caller themselves).
create function public.set_user_permission(p_target uuid, p_permission text, p_effect text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_rank int;
  target_rank int;
begin
  if caller is null or not public.has_permission(caller, 'permission.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_effect is not null and p_effect not in ('grant', 'deny') then
    raise exception 'invalid_effect' using errcode = '22023';
  end if;
  if not exists (select 1 from public.permissions where key = p_permission) then
    raise exception 'unknown_permission' using errcode = '22023';
  end if;

  select public.role_rank(p.role) into target_rank from public.profiles p where p.id = p_target;
  if target_rank is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;
  select public.role_rank(p.role) into caller_rank from public.profiles p where p.id = caller;
  if p_target = caller or caller_rank is null or target_rank >= caller_rank then
    raise exception 'hierarchy_violation' using errcode = '42501';
  end if;
  if p_effect = 'grant' and not public.has_permission(caller, p_permission) then
    raise exception 'privilege_escalation' using errcode = '42501';
  end if;

  if p_effect is null then
    delete from public.permission_overrides where user_id = p_target and permission = p_permission;
  else
    insert into public.permission_overrides (user_id, permission, effect, created_by)
    values (p_target, p_permission, p_effect, caller)
    on conflict (user_id, permission)
    do update set effect = excluded.effect, created_by = excluded.created_by, created_at = now();
  end if;

  perform public.write_audit(
    case p_effect
      when 'grant' then 'user_permission.granted'
      when 'deny' then 'user_permission.denied'
      else 'user_permission.cleared'
    end,
    p_target,
    jsonb_build_object('permission', p_permission)
  );
end;
$$;

revoke execute on function public.set_user_permission(uuid, text, text) from public, anon;
grant execute on function public.set_user_permission(uuid, text, text) to authenticated;

-- RLS: users see their own overrides; permission managers see all; nobody writes directly.
alter table public.permission_overrides enable row level security;

revoke all on public.permission_overrides from anon, authenticated;
grant select on public.permission_overrides to authenticated;

create policy "permission_overrides_select" on public.permission_overrides
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_permission((select auth.uid()), 'permission.manage'))
  );
