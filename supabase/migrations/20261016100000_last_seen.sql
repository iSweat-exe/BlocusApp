-- Last activity of a user ("En ligne" / "Il y a 3 h" on the admin user page).
--
-- `user_activity.last_seen_at` used to move at most once per hour, which is enough for the hourly statistics but
-- far too coarse to say "online". touch_activity() now moves it every 5 minutes (the proxy already throttles the
-- calls with a 5-minute cookie), while the hourly counter of `activity_hours` still counts a user once per hour:
-- it increments only when the previous `last_seen_at` was in an earlier hour (or did not exist).
-- Writes: at most one tiny upsert per active user every 5 minutes, on a table with one row per user.
--
-- Reading is closed to clients like the rest of the activity tables: get_last_seen() returns the date to the
-- holders of `user.activity.view` only.

insert into public.permissions (key, description) values
  ('user.activity.view', 'See when a user was last active');
insert into public.role_permissions (role, permission) values ('admin', 'user.activity.view');

-- Same signature as before: replaced in place.
create or replace function public.touch_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  this_hour timestamptz := date_trunc('hour', now(), 'UTC');
  previous timestamptz;
  counted boolean := false;
begin
  if caller is null then
    return;
  end if;

  select a.last_seen_at into previous
    from public.user_activity a
   where a.user_id = caller
     for update;

  if not found then
    insert into public.user_activity (user_id, last_seen_at)
    values (caller, now())
    on conflict (user_id) do nothing;
    counted := found;
  elsif previous < now() - interval '5 minutes' then
    update public.user_activity set last_seen_at = now() where user_id = caller;
    counted := previous < this_hour;
  end if;

  if counted then
    insert into public.activity_hours as h (hour, active_users)
    values (this_hour, 1)
    on conflict (hour) do update set active_users = h.active_users + 1;
  end if;
end;
$$;

revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

-- When a user was last seen, or null when never (account older than the tracking). Needs `user.activity.view`.
create function public.get_last_seen(p_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.has_permission((select auth.uid()), 'user.activity.view'), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return (select a.last_seen_at from public.user_activity a where a.user_id = p_user_id);
end;
$$;

revoke execute on function public.get_last_seen(uuid) from public, anon;
grant execute on function public.get_last_seen(uuid) to authenticated;
