-- Permission changes must reach the people concerned right away.
-- Roles and permissions travel in the JWT (custom_access_token_hook), which is only re-issued when it
-- expires (15 min locally, 1 h by default on a hosted project): a friend promoted to admin, a permission
-- granted to one user or to a role, or a new permission added to the catalogue stayed invisible until then.
-- This single-row "epoch" records the last time any of those inputs changed. The application compares it with
-- the token's issue time and re-issues the token as soon as it is older (see src/lib/supabase/middleware.ts).

create table public.permission_epoch (
  singleton boolean primary key default true constraint permission_epoch_singleton check (singleton),
  changed_at timestamptz not null default now()
);

comment on table public.permission_epoch is
  'One row: when the inputs of the JWT claims (roles, permissions, overrides, sanctions) last changed.';

insert into public.permission_epoch default values;

-- Deny by default: only the SECURITY DEFINER functions below read or write it.
alter table public.permission_epoch enable row level security;
revoke all on public.permission_epoch from anon, authenticated;

create function public.touch_permission_epoch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.permission_epoch set changed_at = clock_timestamp();
  return null;
end;
$$;

revoke execute on function public.touch_permission_epoch() from public, anon, authenticated;

-- Statement-level: one bump per statement, whatever the number of rows.
create trigger role_permissions_touch_epoch
  after insert or update or delete on public.role_permissions
  for each statement execute function public.touch_permission_epoch();
create trigger permission_overrides_touch_epoch
  after insert or update or delete on public.permission_overrides
  for each statement execute function public.touch_permission_epoch();
-- A new permission changes what super_admin holds.
create trigger permissions_touch_epoch
  after insert or update or delete on public.permissions
  for each statement execute function public.touch_permission_epoch();
-- A role change (assign_role), not every profile edit.
create trigger profiles_role_touch_epoch
  after update of role on public.profiles
  for each statement execute function public.touch_permission_epoch();
-- Bans and their lifting decide whether a token may be issued at all.
create trigger moderation_actions_touch_epoch
  after insert or update or delete on public.moderation_actions
  for each statement execute function public.touch_permission_epoch();

-- Readable by everybody: it is only a timestamp and carries no user data.
create function public.get_permission_epoch()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select changed_at from public.permission_epoch;
$$;

revoke execute on function public.get_permission_epoch() from public;
grant execute on function public.get_permission_epoch() to anon, authenticated, service_role;
