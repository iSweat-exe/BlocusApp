-- A-125a: calendar events. Readable by everyone (Guests included), writable through the event.*
-- permissions, same model as announcements.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) when the author's account is deleted: the event stays published.
  author_id uuid references public.profiles (id) on delete set null,
  title text not null
    constraint events_title_length check (char_length(title) between 1 and 120),
  description text not null default ''
    constraint events_description_length check (char_length(description) <= 5000),
  location text not null default ''
    constraint events_location_length check (char_length(location) <= 200),
  starts_at timestamptz not null,
  -- null = no announced end (or a whole-day event). Otherwise it cannot precede the start.
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

comment on table public.events is 'Calendar events (one-off, no recurrence). Times are stored in UTC.';

-- Day / week views read events by start time; also the author foreign key.
create index events_starts_at_idx on public.events (starts_at, id);
create index events_author_idx on public.events (author_id);

-- Events cannot be created in the past, nor moved there (5 minutes of tolerance for clock skew and slow
-- typing). Editing the text of an event that already started stays possible: only starts_at is checked.
create function public.check_event_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at)
     and new.starts_at < now() - interval '5 minutes' then
    raise exception 'event_in_the_past' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger events_check_start
  before insert or update of starts_at on public.events
  for each row execute function public.check_event_start();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

insert into public.permissions (key, description) values
  ('event.create', 'Create calendar events and edit your own'),
  ('event.delete', 'Delete any calendar event');

insert into public.role_permissions (role, permission) values
  ('manager', 'event.create'),
  ('moderator', 'event.delete'),
  ('admin', 'event.create'),
  ('admin', 'event.delete');

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert (title, description, location, starts_at, ends_at, author_id) on public.events to authenticated;
-- Column-level grant: author_id and created_at never change after creation.
grant update (title, description, location, starts_at, ends_at) on public.events to authenticated;
grant delete on public.events to authenticated;

create policy "events_select_public" on public.events
  for select to anon, authenticated
  using (true);

create policy "events_insert_creators" on public.events
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.has_permission((select auth.uid()), 'event.create'))
  );

-- Creators may edit their own events.
create policy "events_update_own" on public.events
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and (select public.has_permission((select auth.uid()), 'event.create'))
  )
  with check (author_id = (select auth.uid()));

-- event.delete removes any event; creators can remove their own.
create policy "events_delete" on public.events
  for delete to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'event.delete'))
    or (
      author_id = (select auth.uid())
      and (select public.has_permission((select auth.uid()), 'event.create'))
    )
  );
