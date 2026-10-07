-- Events can be marked as finished (and reopened) by holders of the new event.finish permission.
-- A finished event is read-only for its author; it can still be deleted.

alter table public.events
  add column finished_at timestamptz,
  add column finished_by uuid;

comment on column public.events.finished_at is 'Set when the event is marked as finished; null while it is open.';

insert into public.permissions (key, description) values
  ('event.finish', 'Mark any calendar event as finished, or reopen it');

insert into public.role_permissions (role, permission) values
  ('manager', 'event.finish'),
  ('moderator', 'event.finish'),
  ('admin', 'event.finish');

-- Authors can no longer edit an event once it is finished. finished_at / finished_by are not in the
-- column grants of events: they only change through set_event_finished().
drop policy "events_update_own" on public.events;

create policy "events_update_own" on public.events
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and finished_at is null
    and (select public.has_permission((select auth.uid()), 'event.create'))
  )
  with check (author_id = (select auth.uid()));

-- Marks an event as finished (p_finished = true) or reopens it (false). Needs event.finish, applies to any
-- event, is idempotent (a no-op leaves no audit entry) and journaled.
create function public.set_event_finished(p_id uuid, p_finished boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_title text;
  was_finished boolean;
begin
  if caller is null or not public.has_permission(caller, 'event.finish') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select e.title, e.finished_at is not null
    into current_title, was_finished
    from public.events e
   where e.id = p_id;
  if not found then
    raise exception 'unknown_event' using errcode = '22023';
  end if;

  if was_finished = p_finished then
    return;
  end if;

  update public.events
     set finished_at = case when p_finished then now() end,
         finished_by = case when p_finished then caller end
   where id = p_id;

  perform public.write_audit(
    case when p_finished then 'event.finished' else 'event.reopened' end,
    null,
    jsonb_build_object('event_id', p_id, 'title', current_title)
  );
end;
$$;

revoke execute on function public.set_event_finished(uuid, boolean) from public, anon;
grant execute on function public.set_event_finished(uuid, boolean) to authenticated;
