-- A-100: per-user rate limits, enforced in the database.
-- Clients can call PostgREST directly with their own token, so a check in a Server Action alone can be skipped:
-- the limit lives here, on the write paths themselves. The Server Actions only turn the error into a message.
--
-- One row per (user, bucket) holds a fixed window: when the window is older than its length, the next hit starts a
-- new one. A refused hit raises, which rolls the whole statement back (the refused action is not applied, and its
-- hit is not recorded either), so a user who keeps hammering stays refused until the window ends. The table never
-- grows beyond users x buckets, so no clean-up job is needed.

create table public.rate_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null constraint rate_limits_bucket_format check (bucket ~ '^[a-z_]+\.[a-z_]+$'),
  window_start timestamptz not null,
  hits int not null constraint rate_limits_hits_positive check (hits > 0),
  primary key (user_id, bucket)
);

comment on table public.rate_limits is
  'Fixed-window counters of the per-user rate limits, one row per user and bucket. Written by consume_rate_limit() only.';

alter table public.rate_limits enable row level security;

-- No policy and no grant: the table is reachable through consume_rate_limit() only.
revoke all on public.rate_limits from anon, authenticated;

-- Counts one hit of the current user in `p_bucket` and raises 'rate_limited' (54000) past `p_limit` hits per
-- `p_window`. Does nothing without a signed-in user (the service role and maintenance scripts are not limited).
-- Internal: called by the triggers below, never by clients (a free bucket name would let them fill the table).
create function public.consume_rate_limit(p_bucket text, p_limit int, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  now_ts timestamptz := clock_timestamp();
  current_hits int;
begin
  if caller is null then
    return;
  end if;

  insert into public.rate_limits as r (user_id, bucket, window_start, hits)
  values (caller, p_bucket, now_ts, 1)
  on conflict (user_id, bucket) do update
    set window_start = case when r.window_start <= now_ts - p_window then now_ts else r.window_start end,
        hits = case when r.window_start <= now_ts - p_window then 1 else r.hits + 1 end
  returning hits into current_hits;

  if current_hits > p_limit then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, interval) from public, anon, authenticated;

-- Posts: 10 creations or edits per 10 minutes (deletions are not counted).
create function public.announcements_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_rate_limit('announcement.write', 10, interval '10 minutes');
  return new;
end;
$$;

revoke execute on function public.announcements_rate_limit() from public, anon, authenticated;

create trigger announcements_rate_limit
  before insert or update on public.announcements
  for each row execute function public.announcements_rate_limit();

-- Calendar: 30 creations, edits, "finished" toggles per 10 minutes (deletions are not counted).
create function public.events_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.consume_rate_limit('event.write', 30, interval '10 minutes');
  return new;
end;
$$;

revoke execute on function public.events_rate_limit() from public, anon, authenticated;

create trigger events_rate_limit
  before insert or update on public.events
  for each row execute function public.events_rate_limit();

-- Audited actions (roles, permissions, sanctions, map): every one of them goes through write_audit(), so the
-- audit log is the single place to limit them all. 60 per minute for administration, 30 per minute for the map
-- (a manager declares a position every 5 seconds at most, which is 12). 'event.*' entries are skipped: the
-- events trigger above already counts those changes.
create function public.audit_logs_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action like 'map.%' then
    perform public.consume_rate_limit('map.write', 30, interval '1 minute');
  elsif new.action not like 'event.%' then
    perform public.consume_rate_limit('admin.write', 60, interval '1 minute');
  end if;
  return new;
end;
$$;

revoke execute on function public.audit_logs_rate_limit() from public, anon, authenticated;

create trigger audit_logs_rate_limit
  before insert on public.audit_logs
  for each row execute function public.audit_logs_rate_limit();
