begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1@test.dev', '{"user_name": "active_one"}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u2@test.dev', '{"user_name": "active_two"}'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u3@test.dev', '{"user_name": "seen_before"}');

-- A user last seen three hours ago.
insert into public.user_activity (user_id, last_seen_at)
values ('00000000-0000-0000-0000-0000000000c3', now() - interval '3 hours');

set local role authenticated;

-- First user.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select lives_ok($$select public.touch_activity()$$, 'a signed-in user can report their activity');
reset role;
select is(
  (select active_users from public.activity_hours where hour = date_trunc('hour', now(), 'UTC')), 1,
  'the first call counts the user in the current hour');

set local role authenticated;
select lives_ok($$select public.touch_activity()$$, 'calling again in the same hour is allowed');
reset role;
select is(
  (select active_users from public.activity_hours where hour = date_trunc('hour', now(), 'UTC')), 1,
  'a second call in the same hour does not count the user twice');

-- Second user.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated"}';
select public.touch_activity();

-- Third user, last seen in an earlier hour: counted again now.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}';
select public.touch_activity();
reset role;
select is(
  (select active_users from public.activity_hours where hour = date_trunc('hour', now(), 'UTC')), 3,
  'distinct users add up, including one last seen in an earlier hour');
select cmp_ok(
  (select last_seen_at from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000c3'),
  '>=', date_trunc('hour', now(), 'UTC'),
  'the last-seen date of a returning user moves to the current hour');
select is((select count(*)::int from public.activity_hours), 1, 'only one hour has been counted');

-- No signed-in user: nothing happens and nothing fails.
set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated"}';
select lives_ok($$select public.touch_activity()$$, 'a call without a user does nothing');
reset role;
select is((select count(*)::int from public.user_activity), 3, 'and records nobody');

-- The tables are closed to clients, anon cannot call the function.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select throws_ok($$select * from public.user_activity$$, '42501', null, 'a client cannot read user_activity');
set local role anon;
select throws_ok($$select public.touch_activity()$$, '42501', null, 'anon cannot report activity');

-- Hours are whole UTC hours.
reset role;
select throws_ok(
  $$insert into public.activity_hours (hour, active_users) values ('2026-01-01 10:30:00+00', 1)$$,
  '23514', null, 'an hour that is not a whole hour is refused');

-- The activity of a deleted account goes with it.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000c1'),
  0, 'deleting the account deletes its activity row');

select * from finish();
rollback;
