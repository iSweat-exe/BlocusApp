-- A-100: per-user rate limits (announcements, events, audited administration and map actions).
begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@test.dev', '{"user_name": "other_manager"}');

update public.profiles set role = 'manager' where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a6');

-- The counters are closed to clients, and so is the function that moves them.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok($$select * from public.rate_limits$$, '42501', null, '1. clients cannot read the counters');
select throws_ok($$select public.consume_rate_limit('announcement.write', 10, interval '10 minutes')$$, '42501', null,
  '2. clients cannot call consume_rate_limit() themselves');

-- Posts: 10 per 10 minutes.
select lives_ok(
  $$insert into public.announcements (author_id, title, body)
    select '00000000-0000-0000-0000-0000000000a2', 'Post ' || g, 'Texte.' from generate_series(1, 10) g$$,
  '3. a manager publishes 10 posts');
select throws_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a2', 'Trop', 'Texte.')$$,
  '54000', 'rate_limited', '4. the 11th is refused');
select throws_ok(
  $$update public.announcements set title = 'Modifié' where author_id = '00000000-0000-0000-0000-0000000000a2'$$,
  '54000', 'rate_limited', '5. an edit counts as well');
select lives_ok(
  $$delete from public.announcements where author_id = '00000000-0000-0000-0000-0000000000a2'$$,
  '6. deleting is never refused');

-- Somebody else has their own counter.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a6", "role": "authenticated"}';
select lives_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a6', 'Autre', 'Texte.')$$,
  '7. another user is not affected');
reset role;

select is(
  (select hits from public.rate_limits where user_id = '00000000-0000-0000-0000-0000000000a2' and bucket = 'announcement.write'),
  10, '8. a refused hit is not recorded');

-- When the window is over, the count starts again.
update public.rate_limits set window_start = now() - interval '11 minutes'
 where user_id = '00000000-0000-0000-0000-0000000000a2' and bucket = 'announcement.write';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a2', 'Après', 'Texte.')$$,
  '9. after the window, publishing works again');
reset role;
select is(
  (select hits from public.rate_limits where user_id = '00000000-0000-0000-0000-0000000000a2' and bucket = 'announcement.write'),
  1, '10. and the count restarted at one');

-- Events: 30 per 10 minutes.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$insert into public.events (author_id, title, starts_at)
    select '00000000-0000-0000-0000-0000000000a2', 'Evt ' || g, now() + interval '1 day' from generate_series(1, 30) g$$,
  '11. a manager creates 30 events');
select throws_ok(
  $$insert into public.events (author_id, title, starts_at) values ('00000000-0000-0000-0000-0000000000a2', 'Trop', now() + interval '1 day')$$,
  '54000', 'rate_limited', '12. the 31st is refused');
reset role;

-- Audited actions: 60 per minute for administration, 30 for the map, none for the event entries.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a6", "role": "authenticated"}';
select lives_ok($$select public.write_audit('role.assigned', null) from generate_series(1, 60)$$,
  '13. an administrator makes 60 audited changes in a minute');
select throws_ok($$select public.write_audit('role.assigned', null)$$, '54000', 'rate_limited',
  '14. the 61st is refused');
select throws_ok($$select public.write_audit('user.banned', null)$$, '54000', 'rate_limited',
  '15. every administration action shares the same limit');
select lives_ok($$select public.write_audit('map.route_saved', null) from generate_series(1, 30)$$,
  '16. the map has its own counter of 30');
select throws_ok($$select public.write_audit('map.route_saved', null)$$, '54000', 'rate_limited',
  '17. the 31st map action is refused');
select lives_ok($$select public.write_audit('event.finished', null) from generate_series(1, 100)$$,
  '18. event entries are not counted twice');

-- Without a signed-in user (service role, maintenance), nothing is limited and nothing is stored.
set local request.jwt.claims = '{}';
select lives_ok(
  $$insert into public.announcements (author_id, title, body) select null, 'Maintenance ' || g, 'Texte.' from generate_series(1, 50) g$$,
  '19. no limit without a user');
select is((select count(*)::int from public.rate_limits where bucket = 'announcement.write'), 2, '20. and no counter is created for it');

select * from finish();
rollback;
