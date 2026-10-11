begin;
select plan(34);

-- The dev seed (supabase/seed.sql) runs before the tests and already holds accounts: every figure is compared with
-- what existed before the fixtures below, never with an absolute number.
create temp table base as
select
  (select count(*)::int from public.profiles) as users,
  (select count(*)::int from public.profiles where created_at > now() - interval '24 hours') as signups_24h,
  (select count(*)::int from public.profiles where created_at > now() - interval '7 days') as signups_7d,
  (select count(*)::int from public.profiles where created_at > now() - interval '30 days') as signups_30d,
  (select count(*)::int from public.profiles
    where created_at >= date_trunc('hour', now(), 'UTC') - interval '23 hours') as signups_window,
  (select count(*)::int from public.user_activity where last_seen_at > now() - interval '24 hours') as active_24h,
  (select count(*)::int from public.user_activity where last_seen_at > now() - interval '7 days') as active_7d,
  (select count(*)::int from public.user_activity where last_seen_at > now() - interval '30 days') as active_30d,
  (select count(distinct target_id)::int from public.moderation_actions
    where kind = 'ban' and revoked_at is null and (expires_at is null or expires_at > now())) as banned,
  (select count(*)::int from public.announcements where status = 'public') as posts,
  (select count(*)::int from public.events) as events,
  (select count(*)::int from public.events where starts_at > now() and finished_at is null) as upcoming,
  (select count(*)::int from public.map_positions where removed_at is null) as positions,
  (select count(*)::int from public.profiles where role = 'manager') as managers,
  (select count(*)::int from auth.users where raw_app_meta_data ->> 'provider' = 'discord') as discord,
  (select count(*)::int from auth.users where raw_app_meta_data ->> 'provider' is null) as no_provider,
  (select count(*)::int from public.profiles p
    where not exists (select 1 from public.signup_origins o where o.user_id = p.id and o.country is not null)) as no_country,
  (select count(*)::int from public.signup_origins where country = 'FR') as fr,
  (select count(*)::int from public.signup_origins where country = 'BE') as be;
grant select on base to public;

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
  array['admin', 'developer'],
  'statistics.view is granted to admin and developer');

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

select is((select users_total from public.stats_overview()), (select users + 4 from base), 'overview: users');
select is((select signups_24h from public.stats_overview()), (select signups_24h + 3 from base), 'overview: sign-ups in 24 hours');
select is((select signups_7d from public.stats_overview()), (select signups_7d + 3 from base), 'overview: sign-ups in 7 days (the 10-day-old account is out)');
select is((select signups_30d from public.stats_overview()), (select signups_30d + 4 from base), 'overview: sign-ups in 30 days');
select is((select active_24h from public.stats_overview()), (select active_24h + 1 from base), 'overview: active in 24 hours');
select is((select active_7d from public.stats_overview()), (select active_7d + 2 from base), 'overview: active in 7 days');
select is((select active_30d from public.stats_overview()), (select active_30d + 2 from base), 'overview: active in 30 days (40 days ago is out)');
select is((select banned_now from public.stats_overview()), (select banned + 1 from base), 'overview: only the active ban counts');
select is((select posts_public from public.stats_overview()), (select posts + 1 from base), 'overview: drafts are not public posts');
select is((select events_total from public.stats_overview()), (select events + 2 from base), 'overview: events');
select is((select events_upcoming from public.stats_overview()), (select upcoming + 1 from base), 'overview: a finished event is not upcoming');
select is((select positions_active from public.stats_overview()), (select positions + 1 from base), 'overview: removed positions are not counted');
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
  (select sum(signups)::int from public.stats_activity(24)), (select signups_window + 3 from base),
  'activity: sign-ups are counted per hour over the window');

-- Breakdown.
select is(
  (select total from public.stats_breakdown() where kind = 'role' and key = 'manager'), (select managers + 1 from base),
  'breakdown: users per role');
select is(
  (select total from public.stats_breakdown() where kind = 'provider' and key = 'discord'), (select discord + 2 from base),
  'breakdown: accounts per sign-up provider');
select is(
  (select total from public.stats_breakdown() where kind = 'provider' and key = 'unknown'), (select no_provider + 1 from base),
  'breakdown: an account without provider is "unknown"');
select is(
  (select total from public.stats_breakdown() where kind = 'country' and key = 'FR'), (select fr + 2 from base),
  'breakdown: accounts per sign-up country');
select is(
  (select total from public.stats_breakdown() where kind = 'country' and key = 'BE'), (select be + 1 from base),
  'breakdown: another country');
select is(
  (select total from public.stats_breakdown() where kind = 'country' and key = 'unknown'), (select no_country + 1 from base),
  'breakdown: the accounts without a known country are "unknown"');

select * from finish();
rollback;
