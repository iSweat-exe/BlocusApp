begin;
select plan(30);

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

create function pg_temp.claims_for(p_user uuid) returns jsonb language sql as $$
  select public.custom_access_token_hook(
    jsonb_build_object('user_id', p_user, 'claims', jsonb_build_object('sub', p_user))
  ) -> 'claims'
$$;

-- 1-2. effective_permissions: role permissions, and everything for super_admin.
select is(public.effective_permissions('00000000-0000-0000-0000-0000000000a2'),
  array['announcement.publish', 'event.create', 'map.position.declare', 'map.route.edit'],
  'manager has exactly its role permissions');
select is(cardinality(public.effective_permissions('00000000-0000-0000-0000-0000000000a5')),
  (select count(*)::int from public.permissions), 'super_admin has the whole catalogue');

-- Admin sets a grant for a user and a deny for a manager.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a1', 'announcement.publish', 'grant')$$,
  '3. admin can grant a permission to a user');
select lives_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a2', 'announcement.publish', 'deny')$$,
  '4. admin can deny a permission to a manager');

reset role;
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a1', 'announcement.publish'), '5. the grant takes effect');
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a2', 'announcement.publish'), '6. the deny wins over the role');
select ok(pg_temp.claims_for('00000000-0000-0000-0000-0000000000a1') -> 'permissions' @> '"announcement.publish"'::jsonb, '7. JWT claims include the grant');
select ok(not (pg_temp.claims_for('00000000-0000-0000-0000-0000000000a2') -> 'permissions' @> '"announcement.publish"'::jsonb), '8. JWT claims exclude the deny');

insert into public.permission_overrides (user_id, permission, effect) values ('00000000-0000-0000-0000-0000000000a5', 'user.ban', 'deny');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a5', 'user.ban'), '9. super_admin ignores overrides');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a2', 'announcement.publish', null)$$,
  '10. admin can clear an override');
reset role;
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a2', 'announcement.publish'), '11. clearing restores the role permission');

-- Hierarchy and validation (admin).
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a4', 'user.ban', 'deny')$$,
  '42501', 'hierarchy_violation', '12. nobody edits their own overrides');
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a7', 'user.ban', 'deny')$$,
  '42501', 'hierarchy_violation', '13. admin cannot act on another admin');
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a5', 'user.ban', 'deny')$$,
  '42501', 'hierarchy_violation', '14. admin cannot act on a super_admin');
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a1', 'nope.nope', 'grant')$$,
  '22023', 'unknown_permission', '15. unknown permissions are rejected');
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a1', 'user.ban', 'maybe')$$,
  '22023', 'invalid_effect', '16. invalid effects are rejected');

-- Role matrix (admin).
select lives_ok($$select public.set_role_permission('moderator', 'announcement.publish', true)$$,
  '17. admin can grant a permission to a lower role');
reset role;
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a3', 'announcement.publish'), '18. the role change takes effect');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok($$select public.set_role_permission('moderator', 'announcement.publish', false)$$, '19. admin can revoke it again');
reset role;
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a3', 'announcement.publish'), '20. the revocation takes effect');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select throws_ok($$select public.set_role_permission('admin', 'user.ban', false)$$,
  '42501', 'hierarchy_violation', '21. admin cannot edit the admin role');
select throws_ok($$select public.set_role_permission('super_admin', 'user.ban', false)$$,
  '42501', 'hierarchy_violation', '22. nobody edits the super_admin role');
select throws_ok($$select public.set_role_permission('wizard', 'user.ban', true)$$,
  '22023', 'unknown_role', '23. unknown roles are rejected');

-- No privilege escalation: super_admin lets moderators manage permissions, but only within their own.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select lives_ok($$select public.set_role_permission('moderator', 'permission.manage', true)$$,
  '24. super_admin can grant permission.manage to moderators');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a1', 'user.ban', 'grant')$$,
  '42501', 'privilege_escalation', '25. a moderator cannot grant a permission they lack');
select lives_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a1', 'user.mute', 'grant')$$,
  '26. a moderator can grant a permission they hold');

-- Without permission.manage.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok($$select public.set_user_permission('00000000-0000-0000-0000-0000000000a1', 'user.mute', 'deny')$$,
  '42501', 'forbidden', '27. a manager cannot manage permissions');

-- Overrides are private to their owner and to permission managers.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is((select count(*)::int from public.permission_overrides where user_id <> '00000000-0000-0000-0000-0000000000a1'), 0,
  '28. a user only sees their own overrides');

set local role anon;
select throws_ok($$select public.set_role_permission('user', 'user.ban', true)$$, '42501', null, '29. anon cannot call the RPC');

-- Every change was journaled.
reset role;
select is((select count(*)::int from public.audit_logs where action like 'user_permission.%' or action like 'role_permission.%'), 7,
  '30. permission changes are in the audit log');

select * from finish();
rollback;
