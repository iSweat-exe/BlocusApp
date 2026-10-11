-- Hourly activity: how many distinct signed-in users used the app in each hour (statistics page).
--
-- Two tiny tables. `user_activity` keeps the last hour each user was seen, `activity_hours` counts the distinct
-- users seen in each hour. touch_activity() counts a user in an hour only the first time, so calling it often is
-- harmless; the proxy still calls it at most once per hour and per browser (cookie), to keep the load near zero.
-- `activity_hours` grows by 24 rows a day (about 9 000 a year): no purge job is needed.
--
-- No Realtime presence: one websocket per visitor would eat the ~200 connections of the free tier (ADR 0006).
-- Hours are whole UTC hours; the application converts them to Paris time for display.

create table public.user_activity (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

comment on table public.user_activity is
  'Last time each signed-in user was seen (at most one update per hour). Written by touch_activity() only.';

create table public.activity_hours (
  hour timestamptz primary key
    constraint activity_hours_whole_hour
    check ((hour at time zone 'UTC') = date_trunc('hour', hour at time zone 'UTC')),
  active_users integer not null default 0
    constraint activity_hours_active_users_range check (active_users >= 0)
);

comment on table public.activity_hours is
  'Distinct signed-in users seen in each UTC hour. Written by touch_activity() only.';

alter table public.user_activity enable row level security;
alter table public.activity_hours enable row level security;

-- No policy and no grant: both tables are reachable through touch_activity() and the statistics functions only.
revoke all on public.user_activity, public.activity_hours from anon, authenticated;

-- Notes that the current user is active in this hour. Does nothing without a signed-in user. Idempotent within an
-- hour: only the first call of a user in an hour moves the counter.
create function public.touch_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  this_hour timestamptz := date_trunc('hour', now(), 'UTC');
begin
  if caller is null then
    return;
  end if;

  -- The WHERE clause makes the upsert a no-op when the user was already seen in this hour (FOUND stays false).
  insert into public.user_activity as a (user_id, last_seen_at)
  values (caller, now())
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at
    where a.last_seen_at < this_hour;

  if found then
    insert into public.activity_hours as h (hour, active_users)
    values (this_hour, 1)
    on conflict (hour) do update set active_users = h.active_users + 1;
  end if;
end;
$$;

revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;
