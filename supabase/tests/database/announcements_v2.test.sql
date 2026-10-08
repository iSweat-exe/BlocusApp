begin;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mo@test.dev', '{"user_name": "the_moderator"}'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@test.dev', '{"user_name": "other_manager"}');

update public.profiles set role = 'manager' where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a6');
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000a3';

-- Rows created as the table owner (the application never sets the id itself).
insert into public.announcements (id, author_id, title, body, status)
values
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000a2', 'Brouillon', 'Pas fini.', 'draft'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-0000000000a2', 'Privé', 'Pour moi.', 'private');

-- Existing behavior: a post is public by default and gets a publication date; the author stays hidden.
insert into public.announcements (id, author_id, title, body)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a2', 'Public par défaut', 'Texte.');
select is(
  (select row(status, show_author, published_at is not null)::text from public.announcements where id = '00000000-0000-0000-0000-00000000f001'),
  row('public', false, true)::text,
  'a post is public, without author, with a publication date by default');

select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'announcement-images'),
  row(true, 307200, array['image/webp', 'image/jpeg'])::text,
  'the bucket is public, capped at 300 KB, WebP and JPEG only');

-- Guest: reads the feed only; the table is closed; the author is hidden unless asked.
set local role anon;
select is((select count(*)::int from public.announcement_feed), 1, 'anon reads the public feed');
select is(
  (select row(author_id, author_pseudo, author_avatar_url)::text from public.announcement_feed
    where id = '00000000-0000-0000-0000-00000000f001'),
  row(null, null, null)::text,
  'the feed hides the author when show_author is false');
select throws_ok($$select * from public.announcements$$, '42501', null, 'anon cannot read the table');

-- Manager: draft, private, public, with an image in their own folder.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select is(
  (select count(*)::int from public.announcements where author_id = '00000000-0000-0000-0000-0000000000a2'),
  3, 'the author reads all their posts, whatever the status');
select is(
  (select published_at from public.announcements where id = '00000000-0000-0000-0000-00000000f002'), null,
  'a draft has no publication date');

-- Others never see drafts and private posts: not in the feed, not in the table.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a6", "role": "authenticated"}';
select is(
  (select count(*)::int from public.announcements where id in ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f003')),
  0, 'another manager cannot read drafts nor private posts');
select is((select count(*)::int from public.announcement_feed), 1, 'drafts and private posts are not in the feed');

-- Moderators read public rows (to delete them) but not other people's drafts.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select is(
  (select count(*)::int from public.announcements), 1,
  'a moderator reads public rows only, not drafts nor private posts');

-- Publishing a draft sets the date, shows it in the feed, and "show author" reveals the author.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
update public.announcements set status = 'public', show_author = true
 where id = '00000000-0000-0000-0000-00000000f002';
select isnt(
  (select published_at from public.announcements where id = '00000000-0000-0000-0000-00000000f002'), null,
  'publishing a draft sets the publication date');
select is(
  (select author_pseudo from public.announcement_feed where id = '00000000-0000-0000-0000-00000000f002'),
  'the_manager', 'the feed shows the author when show_author is true');
select is(
  (select author_id from public.announcement_feed where id = '00000000-0000-0000-0000-00000000f002'),
  '00000000-0000-0000-0000-0000000000a2'::uuid, 'and their id');

-- edited_at: set when a public post's text changes, not for a draft nor for a status change alone.
select is(
  (select edited_at from public.announcements where id = '00000000-0000-0000-0000-00000000f002'), null,
  'publishing a draft does not mark it as edited');
update public.announcements set title = 'Brouillon corrigé' where id = '00000000-0000-0000-0000-00000000f002';
select isnt(
  (select edited_at from public.announcements where id = '00000000-0000-0000-0000-00000000f002'), null,
  'changing the text of a public post marks it as edited');
update public.announcements set title = 'Privé corrigé' where id = '00000000-0000-0000-0000-00000000f003';
select is(
  (select edited_at from public.announcements where id = '00000000-0000-0000-0000-00000000f003'), null,
  'editing a private post does not mark it as edited');

-- Constraints and ownership.
select throws_ok(
  $$insert into public.announcements (author_id, title, body, status) values ('00000000-0000-0000-0000-0000000000a2', 't', 'b', 'secret')$$,
  '23514', null, 'an unknown status is refused');
select throws_ok(
  $$insert into public.announcements (author_id, title, body, image_path, image_width, image_height) values ('00000000-0000-0000-0000-0000000000a2', 't', 'b', '00000000-0000-0000-0000-0000000000a2/bad.png', 10, 10)$$,
  '23514', null, 'a malformed image path is refused');
select throws_ok(
  $$insert into public.announcements (author_id, title, body, image_path) values ('00000000-0000-0000-0000-0000000000a2', 't', 'b', '00000000-0000-0000-0000-0000000000a2/11111111-1111-1111-1111-111111111111.webp')$$,
  '23514', null, 'an image without its size is refused');
select throws_ok(
  $$insert into public.announcements (author_id, title, body, image_path, image_width, image_height) values ('00000000-0000-0000-0000-0000000000a2', 't', 'b', '00000000-0000-0000-0000-0000000000a6/11111111-1111-1111-1111-111111111111.webp', 10, 10)$$,
  '42501', null, 'an image in somebody else''s folder is refused');
select lives_ok(
  $$insert into public.announcements (author_id, title, body, image_path, image_width, image_height) values ('00000000-0000-0000-0000-0000000000a2', 'Avec image', 'b', '00000000-0000-0000-0000-0000000000a2/11111111-1111-1111-1111-111111111111.webp', 800, 600)$$,
  'an image in the author''s own folder is accepted');

-- Storage: only publishers write in their own folder.
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('announcement-images', '00000000-0000-0000-0000-0000000000a2/22222222-2222-2222-2222-222222222222.webp')$$,
  'a publisher uploads into their own folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('announcement-images', '00000000-0000-0000-0000-0000000000a6/22222222-2222-2222-2222-222222222222.webp')$$,
  '42501', null, 'nobody uploads into somebody else''s folder');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('announcement-images', '00000000-0000-0000-0000-0000000000a1/33333333-3333-3333-3333-333333333333.webp')$$,
  '42501', null, 'a user without announcement.publish cannot upload');

-- Removing files goes through the Storage API (direct deletes are blocked by Supabase); the policies decide.
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('announcement_images_delete', 'announcement_images_select')
          having count(*) = 2),
  'authors and moderators have select and delete policies on the images');

select * from finish();
rollback;
