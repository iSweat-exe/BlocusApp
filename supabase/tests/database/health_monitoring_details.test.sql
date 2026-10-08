begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';

-- History: 4 snapshots in the last 7 days (one of them "down", one old cron run), one older than 7 days.
delete from public.health_snapshots;
insert into public.health_snapshots (created_at, score, db_ms, source) values
  (now() - interval '1 hour', 100, 100, 'page'),
  (now() - interval '2 hours', 95, 200, 'page'),
  (now() - interval '3 days', 40, 900, 'page'),
  (now() - interval '40 hours', 90, 300, 'cron'),
  (now() - interval '9 days', 10, 5000, 'page');

-- Plain user: no access.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select * from public.health_trends()$$, '42501', 'forbidden', 'a plain user cannot read the trends');
select throws_ok($$select * from public.health_tables()$$, '42501', 'forbidden', 'a plain user cannot read the table sizes');
select throws_ok($$select * from public.health_connections()$$, '42501', 'forbidden', 'a plain user cannot read the connections');

-- anon: no access.
set local role anon;
select throws_ok($$select * from public.health_trends()$$, '42501', null, 'anon cannot call health_trends');

-- Admin.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select is(
  (select row(snapshots_7d, up_7d, min_score_7d)::text from public.health_trends()),
  row(4, 3, 40)::text,
  'the trends cover the last 7 days: 4 snapshots, 3 not down, minimum score 40');
select is(
  (select p95_db_ms_24h from public.health_trends()), 195,
  'the 24 h p95 only uses the last 24 hours (100 ms and 200 ms)');
select cmp_ok(
  (select p95_db_ms_7d from public.health_trends()), '>', 500,
  'the 7 day p95 includes the slow snapshot of 3 days ago');
select cmp_ok(
  (select last_cron_at from public.health_trends()), '<', now() - interval '39 hours',
  'the last cron run is the 40-hour-old snapshot');
select ok((select count(*) between 1 and 5 from public.health_tables()), 'between one and five tables are listed');
select cmp_ok((select open_connections from public.health_connections()), '>=', 1, 'the connections are counted');

-- The throttle is per source: a page snapshot does not hide the cron one.
select isnt(public.record_health_snapshot(90, 10, 10, 1, 1, 1, null, 'page'), null, 'a page snapshot is recorded');
select isnt(public.record_health_snapshot(90, 10, 10, 1, 1, 1, null, 'cron'), null,
  'a cron snapshot right after a page one is still recorded');

-- Service role (the daily cron).
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select lives_ok($$select * from public.health_trends()$$, 'the service role can read the trends');

select * from finish();
rollback;
