-- A-135b: Web Push subscriptions: closed table, save / remove functions, endpoint allow-list, per-user cap.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o@test.dev', '{"user_name": "other_user"}'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev', '{"user_name": "banned_user"}');

insert into public.moderation_actions (target_id, kind, reason)
values ('00000000-0000-0000-0000-0000000000a5', 'ban', 'test');

-- 87 characters of base64url: the length of an uncompressed P-256 public key.
create temp table keys as select repeat('B', 87) as p256dh, repeat('a', 22) as auth;
grant select on keys to anon, authenticated;

-- Guest: no access at all.
set local role anon;
select throws_ok($$select * from public.push_subscriptions$$, '42501', null, '1. anon cannot read the table');
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc123', (select p256dh from keys), (select auth from keys))$$,
  '42501', null, '2. anon cannot subscribe');

-- A member subscribes; the table stays closed to them as well.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc123', (select p256dh from keys), (select auth from keys))$$,
  '3. a member saves a Chrome / Android subscription');
select throws_ok($$select * from public.push_subscriptions$$, '42501', null, '4. a member cannot read the table, not even their own rows');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/direct', (select p256dh from keys), (select auth from keys))$$,
  '42501', null, '5. direct writes are closed');

-- The endpoint must be a real push service (the server posts to it).
select lives_ok(
  $$select public.save_push_subscription('https://web.push.apple.com/QWERTY12345678901234', (select p256dh from keys), (select auth from keys))$$,
  '6. an Apple endpoint is accepted');
select throws_ok(
  $$select public.save_push_subscription('https://evil.example.com/push', (select p256dh from keys), (select auth from keys))$$,
  '23514', null, '7. an arbitrary address is refused');
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com.evil.example.com/x', (select p256dh from keys), (select auth from keys))$$,
  '23514', null, '8. a look-alike host is refused');
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc123', 'short', (select auth from keys))$$,
  '23514', null, '9. a malformed key is refused');

-- The same device used by another account moves to that account (one row per endpoint).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc123', (select p256dh from keys), (select auth from keys))$$,
  '10. another account takes over the same device');
reset role;
select is(
  (select user_id::text from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'),
  '00000000-0000-0000-0000-0000000000a2', '11. the endpoint now belongs to the new account');

-- Removing: only your own.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok(
  $$select public.remove_push_subscription('https://fcm.googleapis.com/fcm/send/abc123')$$,
  '12. removing somebody else''s subscription does nothing');
reset role;
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'), 1,
  '13. it is still there');

-- A banned user cannot subscribe.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select throws_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/banned', (select p256dh from keys), (select auth from keys))$$,
  '42501', null, '14. a banned user cannot subscribe');

-- At most 10 devices per user: the oldest are dropped.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/device' || g, (select p256dh from keys), (select auth from keys))
      from generate_series(1, 12) g$$,
  '15. a user adds 12 devices');
reset role;
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000a2'), 10,
  '16. only the 10 most recent are kept');

select * from finish();
rollback;
