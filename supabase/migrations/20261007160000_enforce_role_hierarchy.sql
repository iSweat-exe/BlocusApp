-- A-037 / A-058: role hierarchy and last-super_admin protection.
-- Roles can only be changed through assign_role(); clients still cannot update profiles.role.

create function public.role_rank(p_role text)
returns int
language sql
stable
set search_path = ''
as $$
  select r.rank from public.roles r where r.key = p_role;
$$;

-- Changes a user's role. The caller needs role.assign and may only act on users whose current role
-- ranks strictly below their own, and only grant roles that rank strictly below their own.
-- Consequences: nobody can promote to super_admin (SQL/migration only, A-059), nobody can change
-- their own role, and super_admins cannot be modified through the application.
create function public.assign_role(p_target uuid, p_role text)
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
  select public.role_rank(p.role) into target_rank from public.profiles p where p.id = p_target;
  if target_rank is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;

  if caller_rank is null or target_rank >= caller_rank or new_rank >= caller_rank then
    raise exception 'hierarchy_violation' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_target;
end;
$$;

revoke execute on function public.assign_role(uuid, text) from public, anon;
grant execute on function public.assign_role(uuid, text) to authenticated;

-- The last super_admin can neither be demoted nor deleted (also protects manual SQL).
create function public.prevent_last_super_admin_loss()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role is distinct from 'super_admin')
     and not exists (
       select 1 from public.profiles p where p.role = 'super_admin' and p.id <> old.id
     ) then
    raise exception 'last_super_admin' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger profiles_keep_last_super_admin
  before update of role or delete on public.profiles
  for each row execute function public.prevent_last_super_admin_loss();
