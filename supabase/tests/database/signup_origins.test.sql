begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1@test.dev', '{"user_name": "fresh_one"}'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u2@test.dev', '{"user_name": "fresh_two"}'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'old@test.dev', '{"user_name": "old_timer"}');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b3';
-- An account that was created long ago.
update public.profiles set created_at = now() - interval '2 days' where id = '00000000-0000-0000-0000-0000000000b4';

select is(
  (select array_agg(role order by role) from public.role_permissions where permission = 'user.origin.view'),
  array['admin'],
  'user.origin.view is granted to admin only');

-- Service role: the OAuth callback.
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';

select is(
  public.record_signup_origin('00000000-0000-0000-0000-0000000000b1', 'fr', 'ARA', ' Lyon '), true,
  'the service role records the origin of a fresh account');
select is(
  public.record_signup_origin('00000000-0000-0000-0000-0000000000b1', 'BE', null, 'Bruxelles'), false,
  'the first write wins: a second one is ignored');
select is(
  public.record_signup_origin('00000000-0000-0000-0000-0000000000b4', 'FR', null, 'Paris'), false,
  'an account created long ago gets no origin (a later sign-in is not its sign-up)');
select is(
  public.record_signup_origin('00000000-0000-0000-0000-0000000000b2', null, '', '  '), false,
  'an empty origin is not recorded');
select throws_ok(
  $$select public.record_signup_origin('00000000-0000-0000-0000-0000000000b2', 'FRA')$$,
  '23514', null, 'a country that is not a two-letter code is refused');
select is(
  public.record_signup_origin('00000000-0000-0000-0000-0000000000b2', 'de'), true,
  'a country alone is enough');

reset role;
select is(
  (select country || '/' || region || '/' || city from public.signup_origins
    where user_id = '00000000-0000-0000-0000-0000000000b1'),
  'FR/ARA/Lyon',
  'the origin is normalized (upper-case country, trimmed city) and keeps the first values');

-- A signed-in client cannot write, whoever they are.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b3", "role": "authenticated"}';
select throws_ok(
  $$select public.record_signup_origin('00000000-0000-0000-0000-0000000000b4', 'FR')$$,
  '42501', null, 'a client (even an admin) cannot call the writer');
select throws_ok(
  $$insert into public.signup_origins (user_id, country) values ('00000000-0000-0000-0000-0000000000b4', 'FR')$$,
  '42501', null, 'a client cannot insert an origin directly');

-- Admin: can read.
select is((select count(*)::int from public.signup_origins), 2, 'an admin reads the origins');

-- Plain user: sees nothing, not even their own.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select is((select count(*)::int from public.signup_origins), 0, 'a plain user sees no origin, not even their own');

-- anon: no access.
set local role anon;
select throws_ok($$select * from public.signup_origins$$, '42501', null, 'anon cannot read origins');
select throws_ok(
  $$select public.record_signup_origin('00000000-0000-0000-0000-0000000000b2', 'FR')$$,
  '42501', null, 'anon cannot call the writer');

-- The origin goes with the account.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select count(*)::int from public.signup_origins where user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'deleting the account deletes its origin');
select is(
  (select count(*)::int from public.signup_origins), 1, 'the other origins stay');

select * from finish();
rollback;
