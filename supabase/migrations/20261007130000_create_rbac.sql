-- A-030..A-033: role-based access control stored in the database.
-- Roles and permissions are reference data managed by migrations; clients can only read them.

create table public.roles (
  key text primary key
    constraint roles_key_format check (key ~ '^[a-z][a-z_]{1,31}$'),
  label text not null,
  -- Hierarchy: a user can only act on roles with a strictly lower rank (A-037).
  rank int not null unique
);

comment on table public.roles is 'Roles ordered by rank (higher rank = more power).';

create table public.permissions (
  key text primary key
    constraint permissions_key_format check (key ~ '^[a-z][a-z_]*\.[a-z][a-z_.]*$'),
  description text not null
);

comment on table public.permissions is 'Permission catalogue, keys follow resource.action.';

create table public.role_permissions (
  role text not null references public.roles (key) on update cascade on delete cascade,
  permission text not null references public.permissions (key) on update cascade on delete cascade,
  primary key (role, permission)
);

create index role_permissions_permission_idx on public.role_permissions (permission);

-- Current role of each user. Not part of the column grant of profiles: users cannot change it.
alter table public.profiles
  add column role text not null default 'user';

insert into public.roles (key, label, rank) values
  ('user', 'Utilisateur', 10),
  ('manager', 'Gérant', 20),
  ('moderator', 'Modérateur', 30),
  ('admin', 'Administrateur', 40),
  ('super_admin', 'Super administrateur', 100);

alter table public.profiles
  add constraint profiles_role_fkey foreign key (role) references public.roles (key) on update cascade;

create index profiles_role_idx on public.profiles (role);

insert into public.permissions (key, description) values
  ('announcement.publish', 'Publish an announcement on the home feed'),
  ('announcement.delete', 'Delete any announcement'),
  ('map.route.edit', 'Edit the route drawn on the map'),
  ('map.position.declare', 'Declare the current position of the demonstration'),
  ('user.mute', 'Mute a user'),
  ('user.ban', 'Ban a user'),
  ('role.assign', 'Assign a role to a user');

-- super_admin is not listed here: has_permission() grants it every catalogued permission.
insert into public.role_permissions (role, permission) values
  ('manager', 'announcement.publish'),
  ('manager', 'map.route.edit'),
  ('manager', 'map.position.declare'),
  ('moderator', 'announcement.delete'),
  ('moderator', 'user.mute'),
  ('admin', 'announcement.publish'),
  ('admin', 'announcement.delete'),
  ('admin', 'map.route.edit'),
  ('admin', 'map.position.declare'),
  ('admin', 'user.mute'),
  ('admin', 'user.ban'),
  ('admin', 'role.assign');

-- Returns true when the user's role grants the permission. Used by RLS policies and server checks.
create function public.has_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_user_id
       and (
         exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = p_permission
         )
         or (
           p.role = 'super_admin'
           and exists (select 1 from public.permissions pe where pe.key = p_permission)
         )
       )
  );
$$;

revoke execute on function public.has_permission(uuid, text) from public, anon;
grant execute on function public.has_permission(uuid, text) to authenticated, service_role;

-- RLS: read-only reference data for signed-in users; writes only through migrations.
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

revoke all on public.roles, public.permissions, public.role_permissions from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions to authenticated;

create policy "roles_select_authenticated" on public.roles
  for select to authenticated using (true);
create policy "permissions_select_authenticated" on public.permissions
  for select to authenticated using (true);
create policy "role_permissions_select_authenticated" on public.role_permissions
  for select to authenticated using (true);
