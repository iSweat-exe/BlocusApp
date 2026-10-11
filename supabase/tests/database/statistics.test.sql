begin;
select plan(32);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1@test.dev', '{"user_name": "stat_user"}', '{"provider": "discord"}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "stat_manager"}', '{"provider": "google"}'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "stat_admin"}', '{"provider": "discord"}'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o@test.dev', '{"user_name": "stat_old"}', '{}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d3';
-- d4 signed up 10 days ago, d1 two hours ago, the others just now.
update public.profiles set created_at = now() - interval '10 days' where id = '00000000-0000-0000-0000-0000000000d4';
update public.profiles set created_at = now() - interval '2 hours' where id = '00000000-0000-0000-0000-0000000000d1';

-- Where they signed up from.
insert into public.signup_origins (user_id, country, city) values
  ('00000000-0000-0000-0000-0000000000d1', 'FR', 'Lyon'),
  ('00000000-0000-0000-0000-0000000000d2', 'FR', 'Paris'),
  ('00000000-0000-0000-0000-0000000000d3', 'BE', 'Liège');

-- Activity: d3 is active now, d1 three days ago, d4 forty days ago. Two measured hours.
insert into public.user_activity (user_id, last_seen_at) values
  ('00000000-0000-0000-0000-0000000000d3', now()),
  ('00000000-0000-0000-0000-0000000000d1', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000d4', now() - interval '40 days');
insert into public.activity_hours (hour, active_users) values
  (date_trunc('hour', now(), 'UTC') - interval '3 hours', 4),
  (date_trunc('hour', now(), 'UTC'), 7);

-- Content: 1 public post + 1 draft, 2 events (1 finished), 2 positions (1 removed), 1 active ban + 1 revoked.
insert into public.announcements (title, body, status) values
  ('Public', 'b', 'public'),
  ('Draft', 'b', 'draft');
insert into public.events (title, starts_at, finished_at) values
  ('Soon', now() + interval '1 day', null),
  ('Done', now() + interval '1 hour', now());
insert into public.map_positions (lng, lat, removed_at) values
  (2.35, 48.85, null),
  (2.36, 48.86, now());
insert into public.moderation_actions (target_id, kind, reason, revoked_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'ban', 'spam', null),
  ('00000000-0000-0000-0000-0000000000d4', 'ban', 'old', now());

select is(
  (select array_agg(role order by role) from public.role_permissions where permission = 'statistics.view'),
  array['admin'],
  'statistics.view is granted to admin only');

-- Plain user, manager and anon: refused.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';
select throws_ok($$select * from public.stats_overview()$$, '42501', 'forbidden', 'a plain user cannot read the overview');
select throws_ok($$select * from public.stats_activity(24)$$, '42501', 'forbidden', 'a plain user cannot read the activity');
select throws_ok($$select * from public.stats_breakdown()$$, '42501', 'forbidden', 'a plain user cannot read the breakdown');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}';
select throws_ok($$select * from public.stats_overview()$$, '42501', 'forbidden', 'a manager cannot read the overview');
set local role anon;
select throws_ok($$select * from public.stats_overview()$$, '42501', null, 'anon cannot call the statistics');

-- Admin.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d3", "role": "authenticated"}';

select is((select users_total from public.stats_overview()), 4, 'overview: users');
select is((select signups_24h from public.stats_overview()), 3, 'overview: sign-ups in 24 hours');
select is((select signups_7d from public.stats_overview()), 3, 'overview: sign-ups in 7 days (the 10-day-old account is out)');
select is((select signups_30d from public.stats_overview()), 4, 'overview: sign-ups in 30 days');
select is((select active_24h from public.stats_overview()), 1, 'overview: active in 24 hours');
select is((select active_7d from public.stats_overview()), 2, 'overview: active in 7 days');
select is((select active_30d from public.stats_overview()), 2, 'overview: active in 30 days (40 days ago is out)');
select is((select banned_now from public.stats_overview()), 1, 'overview: only the active ban counts');
select is((select posts_public from public.stats_overview()), 1, 'overview: drafts are not public posts');
select is((select events_total from public.stats_overview()), 2, 'overview: events');
select is((select events_upcoming from public.stats_overview()), 1, 'overview: a finished event is not upcoming');
select is((select positions_active from public.stats_overview()), 1, 'overview: removed positions are not counted');
select is(
  (select tracking_since from public.stats_overview()), date_trunc('hour', now(), 'UTC') - interval '3 hours',
  'overview: tracking starts at the first measured hour');

-- Activity series.
select is((select count(*)::int from public.stats_activity()), 720, 'activity: 30 days of hours by default');
select is((select count(*)::int from public.stats_activity(24)), 24, 'activity: a 24-hour window');
select is((select count(*)::int from public.stats_activity(0)), 1, 'activity: the window is at least one hour');
select is((select count(*)::int from public.stats_activity(100000)), 720, 'activity: and at most 720 hours');
select is(
  (select active_users from public.stats_activity(24) order by hour desc limit 1), 7,
  'activity: the last row is the current hour and carries its count');
select is(
  (select active_users from public.stats_activity(24) where hour = date_trunc('hour', now(), 'UTC') - interval '3 hours'), 4,
  'activity: a measured hour carries its count');
select is(
  (select tracked from public.stats_activity(24) where hour = date_trunc('hour', now(), 'UTC') - interval '4 hours'), false,
  'activity: an hour before the first measure is not tracked');
select is(
  (select tracked from public.stats_activity(24) where hour = date_trunc('hour', now(), 'UTC') - interval '2 hours'), true,
  'activity: an hour without a count after the first measure is a real zero');
select is(
  (select sum(signups)::int from public.stats_activity(24)), 3,
  'activity: sign-ups are counted per hour over the window');

-- Breakdown.
select is(
  (select total from public.stats_breakdown() where kind = 'role' and key = 'manager'), 1,
  'breakdown: users per role');
select is(
  (select total from public.stats_breakdown() where kind = 'provider' and key = 'discord'), 2,
  'breakdown: accounts per sign-up provider');
select is(
  (select total from public.stats_breakdown() where kind = 'provider' and key = 'unknown'), 1,
  'breakdown: an account without provider is "unknown"');
select is(
  (select array_agg(key || ':' || total order by total desc, key) from public.stats_breakdown() where kind = 'country'),
  array['FR:2', 'BE:1', 'unknown:1'],
  'breakdown: top countries, then the accounts without a known country');

select * from finish();
rollback;
