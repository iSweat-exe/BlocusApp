begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.dev', '{"user_name": "seen_now"}'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2@test.dev', '{"user_name": "seen_long_ago"}'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e3@test.dev', '{"user_name": "an_admin"}'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e4@test.dev', '{"user_name": "never_seen"}'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e5@test.dev', '{"user_name": "a_manager"}');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000e3';
update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000e5';

select is(
  (select array_agg(role order by role) from public.role_permissions where permission = 'user.activity.view'),
  array['admin'],
  'user.activity.view is granted to admin only');

-- A user seen a minute ago, one seen in an earlier hour.
insert into public.user_activity (user_id, last_seen_at) values
  ('00000000-0000-0000-0000-0000000000e1', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000e2', date_trunc('hour', now(), 'UTC') - interval '1 minute');

-- touch_activity(): at most one move every 5 minutes.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}';
select public.touch_activity();
reset role;
select cmp_ok(
  (select last_seen_at from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000e1'),
  '<', now() - interval '30 seconds',
  'a call within 5 minutes of the last one does not move the date');
select is((select count(*)::int from public.activity_hours), 0, 'and counts nobody');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated"}';
select public.touch_activity();
reset role;
select cmp_ok(
  (select last_seen_at from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000e2'),
  '>=', now() - interval '1 minute',
  'a call after more than 5 minutes moves the date to now');
select is(
  (select active_users from public.activity_hours where hour = date_trunc('hour', now(), 'UTC')), 1,
  'a user last seen in an earlier hour is counted in this hour');

-- Moving the date inside the same hour does not count the user again. Skipped in the first minutes of an hour,
-- where "more than 5 minutes ago" is necessarily in the previous hour.
update public.user_activity set last_seen_at = date_trunc('hour', now(), 'UTC')
 where user_id = '00000000-0000-0000-0000-0000000000e2';
set local role authenticated;
select public.touch_activity();
reset role;
select ok(
  now() - date_trunc('hour', now(), 'UTC') <= interval '6 minutes'
  or ((select active_users from public.activity_hours where hour = date_trunc('hour', now(), 'UTC')) = 1
      and (select last_seen_at from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000e2') > now() - interval '1 minute'),
  'moving the date within the same hour does not count the user twice');

-- A user without a row yet gets one, and is counted.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e4", "role": "authenticated"}';
select public.touch_activity();
reset role;
select is(
  (select count(*)::int from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000e4'), 1,
  'a first call creates the row');
select is(
  (select active_users from public.activity_hours where hour = date_trunc('hour', now(), 'UTC')), 2,
  'and counts the user');
delete from public.user_activity where user_id = '00000000-0000-0000-0000-0000000000e4';

-- get_last_seen(): admin only.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e3", "role": "authenticated"}';
select cmp_ok(
  public.get_last_seen('00000000-0000-0000-0000-0000000000e1'), '<', now(),
  'an admin reads when a user was last seen');
select is(
  public.get_last_seen('00000000-0000-0000-0000-0000000000e4'), null,
  'a user never seen gives null');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}';
select throws_ok(
  $$select public.get_last_seen('00000000-0000-0000-0000-0000000000e2')$$,
  '42501', 'forbidden', 'a plain user cannot read when someone was last seen');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e5", "role": "authenticated"}';
select throws_ok(
  $$select public.get_last_seen('00000000-0000-0000-0000-0000000000e2')$$,
  '42501', 'forbidden', 'a manager cannot either');
select throws_ok($$select * from public.user_activity$$, '42501', null, 'the table itself stays closed to clients');
set local role anon;
select throws_ok(
  $$select public.get_last_seen('00000000-0000-0000-0000-0000000000e2')$$,
  '42501', null, 'anon cannot call it');

select * from finish();
rollback;
