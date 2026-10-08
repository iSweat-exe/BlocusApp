-- Health monitoring, part 2: trends from the history, heaviest tables and connections.
-- Same access rule as part 1 (can_monitor(): `monitoring.view` or the service role), read-only, SECURITY DEFINER.

-- Availability and latency over the stored history, and when the daily cron last recorded a snapshot.
-- A snapshot with a score under 60 counts as "down" (see statusOfScore in the application).
create function public.health_trends()
returns table (
  snapshots_7d integer,
  up_7d integer,
  min_score_7d integer,
  p95_db_ms_24h integer,
  p95_db_ms_7d integer,
  last_cron_at timestamptz
)
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
      count(*)::integer,
      (count(*) filter (where s.score >= 60))::integer,
      min(s.score)::integer,
      (percentile_cont(0.95) within group (order by s.db_ms)
         filter (where s.created_at > now() - interval '24 hours' and s.db_ms is not null))::integer,
      (percentile_cont(0.95) within group (order by s.db_ms) filter (where s.db_ms is not null))::integer,
      (select max(c.created_at) from public.health_snapshots c where c.source = 'cron')
    from public.health_snapshots s
    where s.created_at > now() - interval '7 days';
end;
$$;

-- The five heaviest tables of the public schema (data and indexes), to see what eats the 500 MB quota.
create function public.health_tables()
returns table (table_name text, size_bytes bigint)
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
    select c.relname::text, pg_total_relation_size(c.oid)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by pg_total_relation_size(c.oid) desc
     limit 5;
end;
$$;

-- Open connections to this database and the server limit.
create function public.health_connections()
returns table (open_connections integer, max_connections integer)
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
      (select count(*)::integer from pg_stat_activity where datname = current_database()),
      current_setting('max_connections')::integer;
end;
$$;

revoke execute on function public.health_trends() from public, anon;
revoke execute on function public.health_tables() from public, anon;
revoke execute on function public.health_connections() from public, anon;
grant execute on function public.health_trends() to authenticated, service_role;
grant execute on function public.health_tables() to authenticated, service_role;
grant execute on function public.health_connections() to authenticated, service_role;

-- The 10-minute throttle of record_health_snapshot() now applies per source. Otherwise a visit to the page just
-- before the daily cron would make the cron's snapshot disappear, and the cron would look stale (cron freshness
-- is read from the last snapshot with source 'cron').
create or replace function public.record_health_snapshot(
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
    select 1 from public.health_snapshots
     where created_at > now() - interval '10 minutes' and source = p_source
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
