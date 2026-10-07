begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2@test.dev', '{"user_name": "other_admin"}'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's@test.dev', '{"user_name": "the_super"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'admin' where id in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a7');
update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a5';

-- Admin: can grant roles below admin to users below admin.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';

select lives_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'manager')$$,
  'admin can promote a user to manager');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'manager',
  'the role was changed');
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'admin')$$,
  '42501', 'hierarchy_violation', 'admin cannot grant a role equal to their own');
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a7', 'user')$$,
  '42501', 'hierarchy_violation', 'admin cannot act on another admin');
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a5', 'user')$$,
  '42501', 'hierarchy_violation', 'admin cannot act on a super_admin');
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a4', 'user')$$,
  '42501', 'hierarchy_violation', 'nobody can change their own role');
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'wizard')$$,
  '22023', 'unknown_role', 'unknown roles are rejected');

-- Manager has no role.assign permission.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'user')$$,
  '42501', 'forbidden', 'a role without role.assign is refused');

-- super_admin: can manage admins but cannot create another super_admin.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select lives_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a7', 'moderator')$$,
  'super_admin can demote an admin');
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'super_admin')$$,
  '42501', 'hierarchy_violation', 'super_admin cannot be granted through the application');

-- anon cannot call it at all.
set local role anon;
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'user')$$,
  '42501', null, 'anon cannot call assign_role');

-- Last super_admin protection (applies to manual SQL too).
reset role;
update public.profiles set role = 'user' where role = 'super_admin' and id <> '00000000-0000-0000-0000-0000000000a5';
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a5'$$,
  '23514', 'last_super_admin', 'the last super_admin cannot be demoted');
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a5'$$,
  '23514', 'last_super_admin', 'the last super_admin cannot be deleted');

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's2@test.dev', '{"user_name": "second_super"}');
update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a8';
select lives_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a5'$$,
  'a super_admin can be demoted when another one remains');

select * from finish();
rollback;
