-- A-113: export_my_data() returns the caller's own data, and only theirs.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'me@test.dev', '{"user_name": "export_me"}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.dev', '{"user_name": "someone_else"}');

insert into public.announcements (author_id, title, body) values
  ('00000000-0000-0000-0000-0000000000d1', 'Mon post', 'Texte.'),
  ('00000000-0000-0000-0000-0000000000d2', 'Post des autres', 'Texte.');
insert into public.signup_origins (user_id, country, region, city)
values ('00000000-0000-0000-0000-0000000000d1', 'BE', 'Bruxelles', 'Ixelles');
insert into public.user_activity (user_id) values ('00000000-0000-0000-0000-0000000000d1');
insert into public.moderation_actions (target_id, kind, reason)
values ('00000000-0000-0000-0000-0000000000d1', 'ban', 'test');

-- Signed out: refused.
set local role anon;
select throws_ok($$select public.export_my_data()$$, '42501', null, 'anon cannot export');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';
select is(public.export_my_data() -> 'account' ->> 'email', 'me@test.dev', 'the account is the caller''s');
select is(public.export_my_data() -> 'profile' ->> 'pseudo', 'export_me', 'the profile is the caller''s');
select is(jsonb_array_length(public.export_my_data() -> 'announcements'), 1, 'only the caller''s own posts');
select is(public.export_my_data() -> 'announcements' -> 0 ->> 'title', 'Mon post', 'and it is the right one');
select is(public.export_my_data() -> 'signup_origin' ->> 'country', 'BE', 'the signup origin, closed to clients, is included');
select isnt(public.export_my_data() -> 'last_seen_at', 'null'::jsonb, 'so is the last activity');
select is(public.export_my_data() -> 'sanctions' -> 0 ->> 'kind', 'ban', 'and the sanction history');
select ok(
  position('p256dh' in public.export_my_data()::text) = 0
  and position('other@test.dev' in public.export_my_data()::text) = 0,
  'no push secret and nothing about other users');

select * from finish();
rollback;
