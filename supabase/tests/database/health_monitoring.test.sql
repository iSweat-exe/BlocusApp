begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';

-- A session refreshed just now makes the admin "active"; another one, long ago, does not count.
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a4', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days');

-- Permission matrix: only admin (and super_admin through has_permission) holds monitoring.view.
select is(
  (select array_agg(role order by role) from public.role_permissions where permission = 'monitoring.view'),
  array['admin'],
  'monitoring.view is granted to admin only');

-- An old snapshot, to check the retention below (inserted as the table owner).
insert into public.health_snapshots (created_at, score, source)
values (now() - interval '31 days', 50, 'cron');

-- Plain user: no access.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select * from public.health_stats()$$, '42501', 'forbidden', 'a plain user cannot read the stats');
select throws_ok(
  $$select public.record_health_snapshot(90, 10, 10, 1000, 1, 1, 'READY', 'page')$$,
  '42501', 'forbidden', 'a plain user cannot record a snapshot');
select is((select count(*)::int from public.health_snapshots), 0, 'a plain user sees no snapshot');

-- Manager: not enough either.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok($$select * from public.health_stats()$$, '42501', 'forbidden', 'a manager cannot read the stats');

-- anon: no access.
set local role anon;
select throws_ok($$select * from public.health_stats()$$, '42501', null, 'anon cannot call health_stats');

-- Admin.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select is(
  (select users_active from public.health_stats()), 1,
  'the stats count only the users active in the last 15 minutes');
select cmp_ok((select db_size_bytes from public.health_stats()), '>', 0::bigint, 'the stats include the database size');
select throws_ok(
  $$select public.record_health_snapshot(150, 1, 1, 1, 1, 1, 'READY', 'page')$$,
  '23514', null, 'a score outside 0..100 is refused');
select isnt(
  public.record_health_snapshot(92, 12, 30, 5000000, 4, 1, 'READY', 'page'), null,
  'an admin records a snapshot');
select is(
  public.record_health_snapshot(93, 12, 30, 5000000, 4, 1, 'READY', 'page'), null,
  'a second snapshot within 10 minutes is skipped');
select is((select count(*)::int from public.health_snapshots), 1, 'the admin reads the history, the 31-day-old row is gone');
select throws_ok(
  $$insert into public.health_snapshots (score) values (50)$$,
  '42501', null, 'clients cannot insert snapshots directly');

-- Service role (the daily cron).
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select lives_ok($$select * from public.health_stats()$$, 'the service role can read the stats');

select * from finish();
rollback;
