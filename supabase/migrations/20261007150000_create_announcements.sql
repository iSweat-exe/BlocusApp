-- A-123a: announcements shown on the home feed. Readable by everyone (Guests included),
-- writable only through the announcement.* permissions.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) when the author's account is deleted: the news stays published.
  author_id uuid references public.profiles (id) on delete set null,
  title text not null
    constraint announcements_title_length check (char_length(title) between 1 and 120),
  body text not null
    constraint announcements_body_length check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is 'News/announcements of the home feed, newest first.';

-- Feed order (keyset pagination on created_at, id) and foreign key.
create index announcements_feed_idx on public.announcements (created_at desc, id desc);
create index announcements_author_idx on public.announcements (author_id);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to anon, authenticated;
grant insert (title, body, author_id) on public.announcements to authenticated;
-- Column-level grant: author_id and created_at never change after publication.
grant update (title, body) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;

create policy "announcements_select_public" on public.announcements
  for select to anon, authenticated
  using (true);

create policy "announcements_insert_publishers" on public.announcements
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.has_permission((select auth.uid()), 'announcement.publish'))
  );

-- Publishers may edit their own announcements.
create policy "announcements_update_own" on public.announcements
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and (select public.has_permission((select auth.uid()), 'announcement.publish'))
  )
  with check (author_id = (select auth.uid()));

-- Moderation: announcement.delete removes any announcement; publishers can remove their own.
create policy "announcements_delete" on public.announcements
  for delete to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'announcement.delete'))
    or (
      author_id = (select auth.uid())
      and (select public.has_permission((select auth.uid()), 'announcement.publish'))
    )
  );
