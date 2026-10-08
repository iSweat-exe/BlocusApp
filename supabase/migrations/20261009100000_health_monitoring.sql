-- Back-end health monitoring (admin page /admin/health): permission, user counters and history of snapshots.
--
-- Access: `monitoring.view` (admin; super_admin through has_permission) and the service role (the daily cron).
-- Nothing here opens a connection per user: "active users" is counted from the Auth sessions that were refreshed
-- recently (the app's 15-minute token is renewed by any request of an active user), not from Realtime presence,
-- which would use one of the ~200 free-tier websockets per visitor.

insert into public.permissions (key, description) values
  ('monitoring.view', 'View the back-end health page (status, usage, history)');
insert into public.role_permissions (role, permission) values ('admin', 'monitoring.view');

-- Whether the caller may read or record monitoring data.
create function public.can_monitor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role') = 'service_role', false)
      or public.has_permission((select auth.uid()), 'monitoring.view');
$$;

revoke execute on function public.can_monitor() from public, anon;
grant execute on function public.can_monitor() to authenticated, service_role;

-- Current counters: registered users, users active in the last 15 minutes and database size.
create function public.health_stats()
returns table (users_total integer, users_active integer, db_size_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_monitor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      (select count(*)::integer from public.profiles),
      (select count(distinct s.user_id)::integer
         from auth.sessions s
        where coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '15 minutes'),
      pg_database_size(current_database());
end;
$$;

revoke execute on function public.health_stats() from public, anon;
grant execute on function public.health_stats() to authenticated, service_role;

-- History of snapshots (one row per measurement of the health page or of the daily cron).
create table public.health_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  score smallint not null constraint health_snapshots_score_range check (score between 0 and 100),
  db_ms integer constraint health_snapshots_db_ms_range check (db_ms between 0 and 600000),
  auth_ms integer constraint health_snapshots_auth_ms_range check (auth_ms between 0 and 600000),
  db_size_bytes bigint constraint health_snapshots_size_range check (db_size_bytes >= 0),
  users_total integer constraint health_snapshots_users_total_range check (users_total >= 0),
  users_active integer constraint health_snapshots_users_active_range check (users_active >= 0),
  vercel_state text constraint health_snapshots_vercel_state_length check (char_length(vercel_state) <= 32),
  source text not null default 'page' constraint health_snapshots_source check (source in ('page', 'cron'))
);

comment on table public.health_snapshots is
  'History of the back-end health measurements. Null measure = could not be taken (down or not configured).';

create index health_snapshots_created_at_idx on public.health_snapshots (created_at desc);

alter table public.health_snapshots enable row level security;
revoke all on public.health_snapshots from anon, authenticated;
grant select on public.health_snapshots to authenticated;

create policy "health_snapshots_select_monitors" on public.health_snapshots
  for select to authenticated
  using ((select public.has_permission((select auth.uid()), 'monitoring.view')));

-- No insert/update/delete policy: rows are written only by record_health_snapshot().

-- Records a snapshot, at most one every 10 minutes (the page may be opened often), and deletes snapshots older
-- than 30 days (a little at each insert: no pg_cron). Returns the new id, or null when throttled.
create function public.record_health_snapshot(
  p_score integer,
  p_db_ms integer default null,
  p_auth_ms integer default null,
  p_db_size_bytes bigint default null,
  p_users_total integer default null,
  p_users_active integer default null,
  p_vercel_state text default null,
  p_source text default 'page'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.can_monitor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.health_snapshots where created_at > now() - interval '10 minutes'
  ) then
    return null;
  end if;

  insert into public.health_snapshots
    (score, db_ms, auth_ms, db_size_bytes, users_total, users_active, vercel_state, source)
  values
    (p_score, p_db_ms, p_auth_ms, p_db_size_bytes, p_users_total, p_users_active, p_vercel_state, p_source)
  returning id into new_id;

  delete from public.health_snapshots
   where id in (
     select id from public.health_snapshots
      where created_at < now() - interval '30 days'
      order by id
      limit 500
   );

  return new_id;
end;
$$;

revoke execute on function public.record_health_snapshot(integer, integer, integer, bigint, integer, integer, text, text)
  from public, anon;
grant execute on function public.record_health_snapshot(integer, integer, integer, bigint, integer, integer, text, text)
  to authenticated, service_role;
