begin;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mo@test.dev', '{"user_name": "the_moderator"}'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@test.dev', '{"user_name": "other_manager"}');

update public.profiles set role = 'manager' where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a6');
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000a3';

insert into public.events (id, author_id, title, description, starts_at)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a2', 'Rassemblement', 'Place centrale.', now() + interval '2 days');

-- Guest (anon): read only.
set local role anon;
select is((select count(*)::int from public.events), 1, '1. anon can read events');
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values (null, 't', now() + interval '1 day')$$,
  '42501', null, '2. anon cannot create events');

-- Plain user: read only.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values ('00000000-0000-0000-0000-0000000000a1', 't', now() + interval '1 day')$$,
  '42501', null, '3. a user without event.create cannot create');
delete from public.events where id = '00000000-0000-0000-0000-00000000e001';
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-00000000e001'), 1,
  '4. a user cannot delete an event');

-- Manager: creates and edits their own events.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$insert into public.events (author_id, title, description, location, starts_at, ends_at)
    values ('00000000-0000-0000-0000-0000000000a2', 'Départ', 'Rendez-vous.', 'Gare', now() + interval '1 day', now() + interval '1 day 2 hours')$$,
  '5. a manager can create an event');
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values ('00000000-0000-0000-0000-0000000000a6', 'Faux', now() + interval '1 day')$$,
  '42501', null, '6. a manager cannot create an event in someone else''s name');
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values ('00000000-0000-0000-0000-0000000000a2', '', now() + interval '1 day')$$,
  '23514', null, '7. an empty title is rejected');
select throws_ok(
  $$insert into public.events (author_id, title, starts_at, ends_at) values ('00000000-0000-0000-0000-0000000000a2', 't', now() + interval '1 day', now() + interval '1 hour')$$,
  '23514', null, '8. an end before the start is rejected');
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values ('00000000-0000-0000-0000-0000000000a2', 't', now() - interval '1 hour')$$,
  '23514', 'event_in_the_past', '9. an event cannot be created in the past');

update public.events set title = 'Rassemblement 15h' where id = '00000000-0000-0000-0000-00000000e001';
select is((select title from public.events where id = '00000000-0000-0000-0000-00000000e001'), 'Rassemblement 15h',
  '10. the author can edit their event');
select throws_ok(
  $$update public.events set author_id = '00000000-0000-0000-0000-0000000000a6' where id = '00000000-0000-0000-0000-00000000e001'$$,
  '42501', null, '11. author_id cannot be changed');
select throws_ok(
  $$update public.events set starts_at = now() - interval '1 day' where id = '00000000-0000-0000-0000-00000000e001'$$,
  '23514', 'event_in_the_past', '12. an event cannot be moved to the past');

-- Another manager can neither edit nor delete it.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a6", "role": "authenticated"}';
update public.events set title = 'Piraté' where id = '00000000-0000-0000-0000-00000000e001';
select is((select title from public.events where id = '00000000-0000-0000-0000-00000000e001'), 'Rassemblement 15h',
  '13. a manager cannot edit another one''s event');
delete from public.events where id = '00000000-0000-0000-0000-00000000e001';
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-00000000e001'), 1,
  '14. a manager cannot delete another one''s event');

-- Moderator: deletes any event but cannot create.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values ('00000000-0000-0000-0000-0000000000a3', 't', now() + interval '1 day')$$,
  '42501', null, '15. a moderator cannot create events');
delete from public.events where id = '00000000-0000-0000-0000-00000000e001';
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-00000000e001'), 0,
  '16. a moderator can delete any event');

-- A manager can delete their own event.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
delete from public.events where title = 'Départ';
select is((select count(*)::int from public.events where title = 'Départ'), 0, '17. a manager can delete their own event');

-- The text of an event that already started stays editable (only starts_at is checked).
reset role;
set local session_replication_role = replica;
insert into public.events (id, author_id, title, starts_at)
values ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000a2', 'En cours', now() - interval '1 hour');
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
update public.events set description = 'Mis à jour' where id = '00000000-0000-0000-0000-00000000e002';
select is((select description from public.events where id = '00000000-0000-0000-0000-00000000e002'), 'Mis à jour',
  '18. the text of an event that already started can still be edited');

select * from finish();
rollback;
