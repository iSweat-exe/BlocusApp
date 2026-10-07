begin;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mo@test.dev', '{"user_name": "the_moderator"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's@test.dev', '{"user_name": "the_super"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';
update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a5';

select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'user',
  'new users get the user role');

-- Role x permission matrix (a few key cells per role).
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a1', 'announcement.publish'), 'user cannot publish');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a2', 'announcement.publish'), 'manager can publish');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a2', 'map.position.declare'), 'manager can declare position');
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a2', 'user.ban'), 'manager cannot ban');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a3', 'user.mute'), 'moderator can mute');
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a3', 'user.ban'), 'moderator cannot ban');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a4', 'user.ban'), 'admin can ban');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a5', 'role.assign'), 'super_admin has every permission');
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a5', 'does.not_exist'), 'unknown permission is denied even for super_admin');
select ok(not public.has_permission(gen_random_uuid(), 'announcement.publish'), 'unknown user is denied');

-- Users cannot change their own role.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select throws_ok(
  $$update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'user cannot escalate their own role');

-- Reference data is readable but not writable by clients.
select cmp_ok((select count(*)::int from public.roles), '=', 5, 'authenticated can read roles');
select cmp_ok((select count(*)::int from public.permissions), '>=', 7, 'authenticated can read permissions');
select throws_ok(
  $$insert into public.role_permissions (role, permission) values ('user', 'user.ban')$$,
  '42501', null, 'client cannot grant permissions');
select throws_ok(
  $$update public.roles set rank = 1000 where key = 'user'$$,
  '42501', null, 'client cannot edit roles');

-- anon: no access at all.
set local role anon;
select throws_ok('select * from public.roles', '42501', null, 'anon cannot read roles');
select throws_ok(
  $$select public.has_permission('00000000-0000-0000-0000-0000000000a2', 'announcement.publish')$$,
  '42501', null, 'anon cannot call has_permission');

select * from finish();
rollback;
