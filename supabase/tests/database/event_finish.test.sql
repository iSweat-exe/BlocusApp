begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mo@test.dev', '{"user_name": "the_moderator"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';

delete from public.audit_logs;
insert into public.events (id, author_id, title, starts_at) values
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-0000000000a2', 'Rassemblement', now() + interval '1 day'),
  ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-0000000000a2', 'Conférence', now() + interval '2 days');

-- 1. The author-manager finishes their own event.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok($$select public.set_event_finished('00000000-0000-0000-0000-00000000f101', true)$$,
  '1. a role with event.finish can mark an event as finished');
reset role;
select ok((select finished_at is not null and finished_by = '00000000-0000-0000-0000-0000000000a2'
             from public.events where id = '00000000-0000-0000-0000-00000000f101'),
  '2. finished_at and finished_by are recorded');

-- 3-4. A finished event is read-only for its author, and finished_* cannot be written directly.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
update public.events set title = 'Piraté' where id = '00000000-0000-0000-0000-00000000f101';
select is((select title from public.events where id = '00000000-0000-0000-0000-00000000f101'), 'Rassemblement',
  '3. the author cannot edit a finished event');
select throws_ok(
  $$update public.events set finished_at = null where id = '00000000-0000-0000-0000-00000000f101'$$,
  '42501', null, '4. finished_at cannot be written directly');

-- 5. A moderator finishes someone else's event (any event).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select lives_ok($$select public.set_event_finished('00000000-0000-0000-0000-00000000f102', true)$$,
  '5. a moderator can finish any event');
-- Idempotent: the second call leaves no extra audit entry.
select public.set_event_finished('00000000-0000-0000-0000-00000000f102', true);

-- 6. Reopening makes it editable again.
select lives_ok($$select public.set_event_finished('00000000-0000-0000-0000-00000000f101', false)$$,
  '6. a finished event can be reopened');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
update public.events set title = 'Rassemblement 15h' where id = '00000000-0000-0000-0000-00000000f101';
select is((select title from public.events where id = '00000000-0000-0000-0000-00000000f101'), 'Rassemblement 15h',
  '7. a reopened event is editable again by its author');

-- 8-10. Refusals.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.set_event_finished('00000000-0000-0000-0000-00000000f101', true)$$,
  '42501', 'forbidden', '8. a user without event.finish cannot finish events');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select throws_ok($$select public.set_event_finished(gen_random_uuid(), true)$$,
  '22023', 'unknown_event', '9. an unknown event is rejected');
set local role anon;
select throws_ok($$select public.set_event_finished('00000000-0000-0000-0000-00000000f101', true)$$,
  '42501', null, '10. anon cannot call set_event_finished');

-- 11. A finished event can still be deleted (event.delete).
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
delete from public.events where id = '00000000-0000-0000-0000-00000000f102';
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-00000000f102'), 0,
  '11. a finished event can still be deleted');

-- 12-14. Journal.
reset role;
select is((select count(*)::int from public.audit_logs where action = 'event.finished'), 2,
  '12. each finish is journaled once (the idempotent call adds nothing)');
select is((select count(*)::int from public.audit_logs where action = 'event.reopened'), 1,
  '13. the reopening is journaled');
select is((select details ->> 'title' from public.audit_logs where action = 'event.reopened'), 'Rassemblement',
  '14. the entry keeps the event title');

-- 15-16. Permission matrix.
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a4', 'event.finish'), '15. admin holds event.finish');
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a1', 'event.finish'), '16. a plain user does not');

select * from finish();
rollback;
