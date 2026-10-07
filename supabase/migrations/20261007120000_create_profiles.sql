-- A-002: public profile linked 1:1 to auth.users, created automatically at sign-up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null
    constraint profiles_pseudo_format check (pseudo ~ '^[A-Za-z0-9_.-]{3,32}$'),
  avatar_url text
    constraint profiles_avatar_url_length check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile of each user (1:1 with auth.users).';

-- Case-insensitive unique pseudo (also serves pseudo lookups).
create unique index profiles_pseudo_lower_key on public.profiles (lower(pseudo));

-- Keeps updated_at accurate on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile when a user signs up (e.g. through Discord OAuth).
-- The provider name only seeds the initial pseudo; it is never used for authorization.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  base := regexp_replace(
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'user'
    ),
    '[^A-Za-z0-9_.-]', '', 'g'
  );
  base := left(base, 24);
  if char_length(base) < 3 then
    base := 'user';
  end if;

  candidate := base;
  if exists (select 1 from public.profiles where lower(pseudo) = lower(candidate)) then
    candidate := base || '_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, pseudo, avatar_url)
  values (new.id, candidate, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: deny by default, one policy per operation.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Column-level grant: users can change only their pseudo and avatar.
grant update (pseudo, avatar_url) on public.profiles to authenticated;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policy: rows are created by the trigger and removed by cascade from auth.users.
