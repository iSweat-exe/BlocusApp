-- A-060: the second factor of the administrator roles, enforced by has_permission() behind a switch.
begin;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.dev', '{"user_name": "the_super"}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.dev', '{"user_name": "the_admin"}'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3@test.dev', '{"user_name": "the_manager"}');

update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000c3';

-- A permission that the base `user` role has (and so do all the others), to see what a held-back session keeps.
insert into public.permissions (key, description) values ('test.base', 'granted to every role');
insert into public.role_permissions (role, permission) values ('user', 'test.base'), ('manager', 'test.base'), ('admin', 'test.base');

-- 1-2. The switch exists, is off by default and closed to clients.
select is(public.admin_mfa_required(), false, '1. the rule is off by default');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated", "aal": "aal1"}';
select throws_ok($$select * from public.security_settings$$, '42501', null, '2. the table is closed to clients');

-- 3. Off: an administrator with a plain session keeps every permission.
select is(public.has_permission('00000000-0000-0000-0000-0000000000c2', 'user.ban'), true, '3. off: an AAL1 administrator can ban');

-- 4-6. Only a super administrator, and only after the second factor, can turn it on.
select throws_ok($$select public.set_admin_mfa_required(true)$$, '42501', 'forbidden', '4. an administrator cannot switch it');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated", "aal": "aal1"}';
select throws_ok($$select public.set_admin_mfa_required(true)$$, '42501', 'mfa_required', '5. a super administrator needs AAL2 to switch it');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated", "aal": "aal2"}';
select lives_ok($$select public.set_admin_mfa_required(true)$$, '6. a super administrator at AAL2 turns it on');

-- 7-10. On: the administrator is held back at AAL1, free at AAL2; their base permissions stay.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated", "aal": "aal1"}';
select is(public.has_permission('00000000-0000-0000-0000-0000000000c2', 'user.ban'), false, '7. on: an AAL1 administrator can no longer ban');
select is(public.has_permission('00000000-0000-0000-0000-0000000000c2', 'test.base'), true, '8. but keeps the base user permissions');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated", "aal": "aal2"}';
select is(public.has_permission('00000000-0000-0000-0000-0000000000c2', 'user.ban'), true, '9. at AAL2 the administrator can ban again');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated"}';
select is(public.has_permission('00000000-0000-0000-0000-0000000000c2', 'user.ban'), false, '10. a token without any aal claim counts as AAL1');

-- 11-12. The super administrator is held back too, and a manager (below the admin rank) is not concerned.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated", "aal": "aal1"}';
select is(public.has_permission('00000000-0000-0000-0000-0000000000c1', 'user.ban'), false, '11. on: an AAL1 super administrator is held back');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated", "aal": "aal1"}';
select is(public.has_permission('00000000-0000-0000-0000-0000000000c3', 'announcement.publish'), true, '12. a manager is not concerned');

-- 13. Asking about somebody else never changes the answer (only the caller's own session is judged).
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated", "aal": "aal1"}';
select is(public.has_permission('00000000-0000-0000-0000-0000000000c2', 'user.ban'), true, '13. the permissions of another user are not affected');

-- Whether a session is held back, as the interface asks it.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated", "aal": "aal1"}';
select is(public.mfa_blocked(), true, '13b. the interface learns that an AAL1 administrator is held back');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated", "aal": "aal2"}';
select is(public.mfa_blocked(), false, '13c. and that an AAL2 one is not');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated", "aal": "aal1"}';
select is(public.mfa_blocked(), false, '13d. nor a manager');
select is(
  (select array_agg(rp.role order by rp.role) from public.role_permissions rp where rp.permission = 'security.manage'),
  null, '13e. security.manage is granted to no role: only super_admin holds it');

-- 14. Turning it off needs the second factor too.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated", "aal": "aal1"}';
select throws_ok($$select public.set_admin_mfa_required(false)$$, '42501', 'mfa_required', '14. turning it off needs AAL2 as well');

-- 15. Every signed-in user can read the switch, a Guest cannot.
select is(public.admin_mfa_required(), true, '15. a signed-in user reads the switch');
set local role anon;
select throws_ok($$select public.admin_mfa_required()$$, '42501', null, '16. anon cannot read it');

-- 17-18. The change is audited.
reset role;
select is(
  (select count(*)::int from public.audit_logs where action = 'security.admin_mfa'
     and actor_id = '00000000-0000-0000-0000-0000000000c1' and (details ->> 'required')::boolean),
  1, '17. turning it on is in the audit log');
select is(
  (select require_admin_mfa from public.security_settings), true, '18. the switch is stored');

select * from finish();
rollback;
