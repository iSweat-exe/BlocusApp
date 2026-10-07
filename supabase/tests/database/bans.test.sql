begin;
select plan(24);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mo@test.dev', '{"user_name": "the_moderator"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's@test.dev', '{"user_name": "the_super"}'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2@test.dev', '{"user_name": "other_admin"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set role = 'admin' where id in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a7');
update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a5';

delete from public.audit_logs;
insert into auth.sessions (id, user_id) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a2');

-- Admin bans the manager permanently.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a2', '  Spam répété  ', null)$$,
  '1. admin can ban a lower role');
reset role;

select ok(public.is_banned('00000000-0000-0000-0000-0000000000a2'), '2. the user is banned');
select is(cardinality(public.effective_permissions('00000000-0000-0000-0000-0000000000a2')), 0,
  '3. a banned user holds no permission');
select is(public.custom_access_token_hook(
    jsonb_build_object('user_id', '00000000-0000-0000-0000-0000000000a2', 'claims', '{}'::jsonb)
  ) -> 'error' ->> 'http_code', '403', '4. the JWT hook refuses a token to a banned user');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000a2'), 0,
  '5. the sessions of the banned user are revoked');
select is((select reason from public.moderation_actions where target_id = '00000000-0000-0000-0000-0000000000a2'),
  'Spam répété', '6. the reason is stored trimmed');
select is((select details ->> 'reason' from public.audit_logs where action = 'user.banned'), 'Spam répété',
  '7. the ban is journaled');

-- A banned manager can no longer publish (RLS), even with a token issued before the ban.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok(
  $$insert into public.announcements (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a2', 't', 'b')$$,
  '42501', null, '8. a banned manager cannot publish');

-- Validation and hierarchy (admin).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a7', 'x', null)$$,
  '42501', 'hierarchy_violation', '9. admin cannot ban another admin');
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a5', 'x', null)$$,
  '42501', 'hierarchy_violation', '10. admin cannot ban a super_admin');
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a4', 'x', null)$$,
  '42501', 'hierarchy_violation', '11. nobody bans themselves');
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a1', '   ', null)$$,
  '22023', 'invalid_reason', '12. a reason is required');
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a1', 'x', now() - interval '1 hour')$$,
  '22023', 'invalid_expiry', '13. the expiry must be in the future');
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a2', 'again', null)$$,
  '23505', 'already_banned', '14. a user cannot be banned twice');
select throws_ok($$select public.ban_user(gen_random_uuid(), 'x', null)$$,
  '22023', 'unknown_user', '15. unknown users are rejected');

-- A moderator holds user.mute but not user.ban.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a1', 'x', null)$$,
  '42501', 'forbidden', '16. a role without user.ban cannot ban');

-- Temporary ban: active, then expired (evaluated when read, no cron).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok($$select public.ban_user('00000000-0000-0000-0000-0000000000a1', 'cool down', now() + interval '1 hour')$$,
  '17. admin can ban temporarily');
reset role;
select ok(public.is_banned('00000000-0000-0000-0000-0000000000a1'), '18. the temporary ban is active');
update public.moderation_actions
   set created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
 where target_id = '00000000-0000-0000-0000-0000000000a1';
select ok(not public.is_banned('00000000-0000-0000-0000-0000000000a1'), '19. an expired ban no longer applies');

-- Lifting a ban early.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok(
  $$select public.revoke_sanction((select id from public.moderation_actions where target_id = '00000000-0000-0000-0000-0000000000a2'))$$,
  '42501', 'forbidden', '20. a role without user.ban cannot lift a ban');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok(
  $$select public.revoke_sanction((select id from public.moderation_actions where target_id = '00000000-0000-0000-0000-0000000000a2'))$$,
  '21. admin can lift a ban');
select throws_ok(
  $$select public.revoke_sanction((select id from public.moderation_actions where target_id = '00000000-0000-0000-0000-0000000000a2'))$$,
  '22023', 'not_active', '22. a lifted ban cannot be lifted again');
reset role;
select ok(not public.is_banned('00000000-0000-0000-0000-0000000000a2'), '23. the user is no longer banned');

-- Sanctions are visible to moderators/admins only; anon has no access.
set local role anon;
select throws_ok('select * from public.moderation_actions', '42501', null, '24. anon cannot read sanctions');

select * from finish();
rollback;
