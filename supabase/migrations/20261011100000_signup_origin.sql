-- Where users sign up from (admin user page): a coarse location taken from the request that creates the account.
--
-- Only the country, the region and the city are kept (the hosting platform derives them from the IP address, which
-- is never stored). A row is written once, by the OAuth callback with the service role: the value comes from a
-- request header that only the server can trust, so clients cannot call the writer and cannot choose their own
-- origin. Reading needs `user.origin.view`. The row disappears with the account (cascade).

insert into public.permissions (key, description) values
  ('user.origin.view', 'See where a user signed up from (country, region, city)');
insert into public.role_permissions (role, permission) values ('admin', 'user.origin.view');

create table public.signup_origins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- ISO 3166-1 alpha-2 code, e.g. FR.
  country text constraint signup_origins_country_format check (country ~ '^[A-Z]{2}$'),
  region text constraint signup_origins_region_length check (char_length(region) between 1 and 64),
  city text constraint signup_origins_city_length check (char_length(city) between 1 and 96),
  created_at timestamptz not null default now(),
  constraint signup_origins_not_empty check (country is not null or region is not null or city is not null)
);

comment on table public.signup_origins is
  'Coarse location (country, region, city) of the request that created each account. Never the IP address.';

-- Statistics group by country.
create index signup_origins_country_idx on public.signup_origins (country);

alter table public.signup_origins enable row level security;

revoke all on public.signup_origins from anon, authenticated;
grant select on public.signup_origins to authenticated;

create policy "signup_origins_select_viewers" on public.signup_origins
  for select to authenticated
  using ((select public.has_permission((select auth.uid()), 'user.origin.view')));

-- No insert/update/delete policy: rows are written only by record_signup_origin().

-- Records where a freshly created account signed up from. First write wins, and only for an account created
-- in the last 15 minutes: the location of a later sign-in says nothing about where the account was created.
-- Service role only. Returns true when a row was written.
create function public.record_signup_origin(
  p_user_id uuid,
  p_country text default null,
  p_region text default null,
  p_city text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country text := upper(nullif(btrim(p_country), ''));
  v_region text := left(nullif(btrim(p_region), ''), 64);
  v_city text := left(nullif(btrim(p_city), ''), 96);
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_country is null and v_region is null and v_city is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles
     where id = p_user_id and created_at > now() - interval '15 minutes'
  ) then
    return false;
  end if;

  insert into public.signup_origins (user_id, country, region, city)
  values (p_user_id, v_country, v_region, v_city)
  on conflict (user_id) do nothing;

  return found;
end;
$$;

revoke execute on function public.record_signup_origin(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_signup_origin(uuid, text, text, text) to service_role;
