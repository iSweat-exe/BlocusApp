-- A-060: two-factor authentication (TOTP) for the administrator roles, enforced in the database.
--
-- Enforcing it only in the interface would not be "non contournable": a stolen OAuth session (AAL1) could still call
-- the RPC functions directly through PostgREST. So the check lives in has_permission(), which every RPC function and
-- every Row Level Security policy goes through. A session that did not pass the second factor (`aal` claim of the JWT
-- different from `aal2`) then only keeps the permissions of the base `user` role.
--
-- The rule is behind a switch, off by default, because turning it on before the administrators enrolled would lock
-- them out. A super administrator turns it on from /admin/security once they enrolled and verified their own factor
-- (the function refuses an AAL1 session, so the person who switches it on can always pass it). Enrolling and
-- verifying a factor never depends on a permission, so an administrator who is held back can always get through.
--
-- To get back in after losing every second factor (documented in docs/runbook.md): as the table owner,
--   update public.security_settings set require_admin_mfa = false;

-- Permission to turn the rule on or off. Granted to nobody: only super_admin, who holds every catalogued permission.
insert into public.permissions (key, description) values
  ('security.manage', 'Turn the second-factor requirement of the administrators on or off');

create table public.security_settings (
  -- One row: `id` can only be true.
  id boolean primary key default true constraint security_settings_single_row check (id),
  require_admin_mfa boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.security_settings is
  'Security switches of the application (one row). Closed to clients: read through admin_mfa_required(), written by set_admin_mfa_required().';

insert into public.security_settings (id) values (true);

alter table public.security_settings enable row level security;
revoke all on public.security_settings from anon, authenticated;

-- Whether the switch is on. Any signed-in user may ask (the interface needs it to know whether to show the second
-- factor screen); it reveals nothing else.
create function public.admin_mfa_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.require_admin_mfa from public.security_settings s where s.id), false);
$$;

revoke execute on function public.admin_mfa_required() from public, anon;
grant execute on function public.admin_mfa_required() to authenticated;

-- Whether the second factor is demanded from THIS session and not given: the switch is on, the user is the caller
-- (other users' permissions are never changed by who asks), their role is an administrator role (rank of `admin`
-- or above) and the session is not AAL2. Internal: only has_permission() calls it.
create function public.mfa_blocks(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_mfa_required()
     and p_user_id is not distinct from (select auth.uid())
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2'
     and exists (
       select 1
         from public.profiles p
         join public.roles r on r.key = p.role
        where p.id = p_user_id
          and r.rank >= (select a.rank from public.roles a where a.key = 'admin')
     );
$$;

revoke execute on function public.mfa_blocks(uuid) from public, anon, authenticated;

-- Whether THIS session is held back right now (the rule is on, the role is an administrator one, the session did
-- not pass the second factor). The interface asks it to know whether to show the second factor screen, so that the
-- screen appears exactly when the database would refuse, never for a role the rule does not concern.
create function public.mfa_blocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mfa_blocks((select auth.uid()));
$$;

revoke execute on function public.mfa_blocked() from public, anon;
grant execute on function public.mfa_blocked() to authenticated;

-- Same rule as before (effective permissions of the role and the overrides), plus the second factor: a session held
-- back at AAL1 keeps what the base `user` role grants, nothing more.
create or replace function public.has_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_permission = any (public.effective_permissions(p_user_id))
     and (
       not public.mfa_blocks(p_user_id)
       or exists (
         select 1 from public.role_permissions rp
          where rp.role = 'user' and rp.permission = p_permission
       )
     );
$$;

-- Turns the rule on or off. Super administrators only, and only from a session that passed the second factor:
-- whoever turns it on is therefore enrolled, and an attacker with a plain session cannot turn it off.
create function public.set_admin_mfa_required(p_required boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  -- effective_permissions(), not has_permission(): this check must not depend on the rule it controls, or a
  -- held-back session would be told "forbidden" instead of "mfa_required".
  if caller is null or not ('security.manage' = any (public.effective_permissions(caller))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  update public.security_settings
     set require_admin_mfa = p_required, updated_at = now(), updated_by = caller
   where id;

  perform public.write_audit('security.admin_mfa', caller, jsonb_build_object('required', p_required));
end;
$$;

revoke execute on function public.set_admin_mfa_required(boolean) from public, anon;
grant execute on function public.set_admin_mfa_required(boolean) to authenticated;
