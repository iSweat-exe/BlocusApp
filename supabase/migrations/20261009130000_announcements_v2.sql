-- Posts v2: visibility (draft / private / public), optional public author, one compressed image, edit mark.
--
-- Visibility: `draft` and `private` are visible to their author only; `public` is visible to everybody (Guests
-- included). The public feed is read through `announcement_feed`, which shows only public posts and reveals the
-- author (id, pseudo, avatar) only when the author ticked "show author". The table itself is no longer readable
-- by `anon`; `authenticated` reads their own rows (and moderators the public ones, to delete them).

alter table public.announcements
  add column status text not null default 'public'
    constraint announcements_status_check check (status in ('draft', 'private', 'public')),
  add column show_author boolean not null default false,
  -- Path inside the `announcement-images` bucket: `<author id>/<random id>.webp|jpg`.
  add column image_path text
    constraint announcements_image_path_format
    check (image_path ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(webp|jpg)$'),
  add column image_width integer
    constraint announcements_image_width_range check (image_width between 1 and 4000),
  add column image_height integer
    constraint announcements_image_height_range check (image_height between 1 and 4000),
  -- When the post became public (the feed is ordered by it, not by creation: a draft can wait).
  add column published_at timestamptz,
  -- Set when a public post's text or image changes.
  add column edited_at timestamptz,
  add constraint announcements_image_complete
    check ((image_path is null) = (image_width is null) and (image_path is null) = (image_height is null));

-- Existing posts were all public.
update public.announcements set published_at = created_at;

create function public.announcements_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'public' then
    if tg_op = 'INSERT' or old.status <> 'public' then
      new.published_at := now();
    end if;
  else
    new.published_at := null;
  end if;

  if tg_op = 'UPDATE' and old.status = 'public' and new.status = 'public'
     and (new.title, new.body, new.image_path) is distinct from (old.title, old.body, old.image_path) then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger announcements_before_write
  before insert or update on public.announcements
  for each row execute function public.announcements_before_write();

-- The public feed index replaces the creation-date one.
drop index public.announcements_feed_idx;
create index announcements_public_feed_idx on public.announcements (published_at desc, id desc)
  where status = 'public';

-- Table access: no more anonymous read, authors read their own rows.
drop policy "announcements_select_public" on public.announcements;
revoke select on public.announcements from anon;

create policy "announcements_select_own" on public.announcements
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or (status = 'public' and (select public.has_permission((select auth.uid()), 'announcement.delete')))
  );

-- Writes. author_id and created_at still never change after the first insert.
grant insert (title, body, author_id, status, show_author, image_path, image_width, image_height)
  on public.announcements to authenticated;
grant update (title, body, status, show_author, image_path, image_width, image_height)
  on public.announcements to authenticated;

-- An image can only point inside the author's own folder.
drop policy "announcements_insert_publishers" on public.announcements;
create policy "announcements_insert_publishers" on public.announcements
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.has_permission((select auth.uid()), 'announcement.publish'))
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );

drop policy "announcements_update_own" on public.announcements;
create policy "announcements_update_own" on public.announcements
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and (select public.has_permission((select auth.uid()), 'announcement.publish'))
  )
  with check (
    author_id = (select auth.uid())
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );

-- Public feed. Intentionally runs with the view owner's rights (not the caller's): `anon` has no access to the
-- table or to `profiles`, and the view decides what is shown. The author appears only when the post asks for it.
create view public.announcement_feed
with (security_invoker = false) as
select
  a.id,
  a.title,
  a.body,
  a.published_at,
  a.edited_at,
  a.image_path,
  a.image_width,
  a.image_height,
  case when a.show_author then a.author_id end as author_id,
  case when a.show_author then p.pseudo end as author_pseudo,
  case when a.show_author then p.avatar_url end as author_avatar_url
from public.announcements a
left join public.profiles p on p.id = a.author_id
where a.status = 'public';

comment on view public.announcement_feed is
  'Public posts for the home feed. The author is revealed only when show_author is true.';

revoke all on public.announcement_feed from public, anon, authenticated;
grant select on public.announcement_feed to anon, authenticated;

-- Images: a public bucket (so the feed can show them without a signed URL), limited at the source to 300 KB and to
-- WebP / JPEG, whatever the client sends. The application compresses before uploading; this is the safety net.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', true, 307200, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Only publishers upload, only into their own folder.
create policy "announcement_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'announcement-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_permission((select auth.uid()), 'announcement.publish'))
  );

-- Authors see and remove their own files; moderators (announcement.delete) remove any (the file of a deleted post).
create policy "announcement_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'announcement-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_permission((select auth.uid()), 'announcement.delete'))
    )
  );

create policy "announcement_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'announcement-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_permission((select auth.uid()), 'announcement.delete'))
    )
  );
