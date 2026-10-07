begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mo@test.dev', '{"user_name": "the_moderator"}'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@test.dev', '{"user_name": "other_manager"}');

update public.profiles set role = 'manager' where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a6');
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000a3';

insert into public.announcements (id, author_id, title, body)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a2', 'Départ 14h', 'Rendez-vous place centrale.');

-- Guest (anon): read only.
set local role anon;
select is((select count(*)::int from public.announcements), 1, 'anon can read announcements');
select throws_ok(
  $$insert into public.announcements (author_id, title, body) values (null, 't', 'b')$$,
  '42501', null, 'anon cannot publish');

-- Plain user: read only.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a1', 't', 'b')$$,
  '42501', null, 'user without announcement.publish cannot publish');
delete from public.announcements where id = '00000000-0000-0000-0000-00000000f001';
select is((select count(*)::int from public.announcements where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'user cannot delete an announcement');

-- Manager: can publish as themselves only.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a2', 'Pause', 'Pause 15 min.')$$,
  'manager can publish');
select throws_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a6', 'Faux', 'Usurpation')$$,
  '42501', null, 'manager cannot publish in someone else''s name');
select throws_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a2', '', 'b')$$,
  '23514', null, 'empty title is rejected');

update public.announcements set title = 'Départ 15h' where id = '00000000-0000-0000-0000-00000000f001';
select is((select title from public.announcements where id = '00000000-0000-0000-0000-00000000f001'), 'Départ 15h',
  'manager can edit their own announcement');
select throws_ok(
  $$update public.announcements set author_id = '00000000-0000-0000-0000-0000000000a6' where id = '00000000-0000-0000-0000-00000000f001'$$,
  '42501', null, 'author_id cannot be changed');

-- Another manager cannot edit nor delete it.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a6", "role": "authenticated"}';
update public.announcements set title = 'Piraté' where id = '00000000-0000-0000-0000-00000000f001';
select is((select title from public.announcements where id = '00000000-0000-0000-0000-00000000f001'), 'Départ 15h',
  'a manager cannot edit another one''s announcement');
delete from public.announcements where id = '00000000-0000-0000-0000-00000000f001';
select is((select count(*)::int from public.announcements where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'a manager cannot delete another one''s announcement');

-- Moderator can delete any announcement but not edit it.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
delete from public.announcements where id = '00000000-0000-0000-0000-00000000f001';
select is((select count(*)::int from public.announcements where id = '00000000-0000-0000-0000-00000000f001'), 0,
  'moderator can delete any announcement');

select * from finish();
rollback;
