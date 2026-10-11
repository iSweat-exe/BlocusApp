-- Statistics page (/admin/statistics): the permission and three read-only aggregate functions.
--
-- Everything is computed from tables that already exist (profiles, signup_origins, user_activity, activity_hours,
-- announcements, events, map_positions, moderation_actions) plus the sign-up provider kept by Auth. The functions
-- are SECURITY DEFINER because most of those tables are closed to clients, and they only ever return counts.

insert into public.permissions (key, description) values
  ('statistics.view', 'View the application statistics (users, sign-ups, activity)');
insert into public.role_permissions (role, permission) values ('admin', 'statistics.view');

-- Headline figures. `tracking_since` is the first hour activity was measured, null while nothing was.
create function public.stats_overview()
returns table (
  users_total integer,
  signups_24h integer,
  signups_7d integer,
  signups_30d integer,
  active_24h integer,
  active_7d integer,
  active_30d integer,
  banned_now integer,
  posts_public integer,
  events_total integer,
  events_upcoming integer,
  positions_active integer,
  tracking_since timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission((select auth.uid()), 'statistics.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      (select count(*)::integer from public.profiles),
      (select count(*)::integer from public.profiles p where p.created_at > now() - interval '24 hours'),
      (select count(*)::integer from public.profiles p where p.created_at > now() - interval '7 days'),
      (select count(*)::integer from public.profiles p where p.created_at > now() - interval '30 days'),
      (select count(*)::integer from public.user_activity a where a.last_seen_at > now() - interval '24 hours'),
      (select count(*)::integer from public.user_activity a where a.last_seen_at > now() - interval '7 days'),
      (select count(*)::integer from public.user_activity a where a.last_seen_at > now() - interval '30 days'),
      (select count(distinct m.target_id)::integer
         from public.moderation_actions m
        where m.kind = 'ban' and m.revoked_at is null and (m.expires_at is null or m.expires_at > now())),
      (select count(*)::integer from public.announcements an where an.status = 'public'),
      (select count(*)::integer from public.events),
      (select count(*)::integer from public.events e where e.starts_at > now() and e.finished_at is null),
      (select count(*)::integer from public.map_positions mp where mp.removed_at is null),
      (select min(h.hour) from public.activity_hours h);
end;
$$;

-- One row per whole UTC hour over the last `p_hours` hours (1 to 720, i.e. 30 days), the current hour included:
-- distinct signed-in users seen, accounts created, and whether activity was already being measured at that hour
-- (before that, "0 users" means "unknown", not "nobody").
create function public.stats_activity(p_hours integer default 720)
returns table (hour timestamptz, active_users integer, signups integer, tracked boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  span integer := least(greatest(coalesce(p_hours, 720), 1), 720);
  last_hour timestamptz := date_trunc('hour', now(), 'UTC');
  first_hour timestamptz := date_trunc('hour', now(), 'UTC') - (span - 1) * interval '1 hour';
  first_tracked timestamptz;
begin
  if not public.has_permission((select auth.uid()), 'statistics.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select min(h.hour) into first_tracked from public.activity_hours h;

  return query
    select
      s.hour,
      coalesce(a.active_users, 0),
      coalesce(g.created, 0)::integer,
      first_tracked is not null and s.hour >= first_tracked
    from generate_series(first_hour, last_hour, interval '1 hour') as s(hour)
    left join public.activity_hours a on a.hour = s.hour
    left join (
      select date_trunc('hour', p.created_at, 'UTC') as hour, count(*) as created
        from public.profiles p
       where p.created_at >= first_hour
       group by 1
    ) g on g.hour = s.hour
    order by s.hour;
end;
$$;

-- Distributions of the accounts, as (kind, key, total) rows:
--   role     one row per role held (key = role key);
--   provider how accounts were created (key = Auth provider such as discord or google, `unknown` if absent);
--   country  the ten most frequent sign-up countries (key = ISO code), plus `unknown` for the accounts without one.
create function public.stats_breakdown()
returns table (kind text, key text, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission((select auth.uid()), 'statistics.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select 'role'::text, p.role, count(*)::integer
      from public.profiles p
     group by p.role;

  return query
    select 'provider'::text, coalesce(u.raw_app_meta_data ->> 'provider', 'unknown'), count(*)::integer
      from auth.users u
      join public.profiles p on p.id = u.id
     group by 2;

  return query
    (select 'country'::text, o.country, count(*)::integer
       from public.signup_origins o
      where o.country is not null
      group by o.country
      order by 3 desc, 2
      limit 10);

  return query
    select 'country'::text, 'unknown'::text, count(*)::integer
      from public.profiles p
     where not exists (
       select 1 from public.signup_origins o where o.user_id = p.id and o.country is not null
     )
     having count(*) > 0;
end;
$$;

revoke execute on function public.stats_overview() from public, anon;
revoke execute on function public.stats_activity(integer) from public, anon;
revoke execute on function public.stats_breakdown() from public, anon;
grant execute on function public.stats_overview() to authenticated;
grant execute on function public.stats_activity(integer) to authenticated;
grant execute on function public.stats_breakdown() to authenticated;
