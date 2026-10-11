begin;
select plan(32);

-- Accounts created below get a role by an UPDATE as the table owner, like the other role tests.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dev@test.dev', '{"user_name": "role_dev"}'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ed@test.dev', '{"user_name": "role_editor"}'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rel@test.dev', '{"user_name": "role_relay"}'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm@test.dev', '{"user_name": "role_admin"}'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plain@test.dev', '{"user_name": "role_plain"}'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mod@test.dev', '{"user_name": "role_moderator"}');

update public.profiles set role = 'developer' where id = '00000000-0000-0000-0000-0000000000f1';
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-0000000000f2';
update public.profiles set role = 'relay' where id = '00000000-0000-0000-0000-0000000000f3';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000f4';
update public.profiles set role = 'moderator' where id = '00000000-0000-0000-0000-0000000000f6';

-- The ladder: the new roles sit in the gaps, nothing was renumbered.
select is(
  (select array_agg(key order by rank) from public.roles),
  array['user', 'relay', 'editor', 'manager', 'moderator', 'developer', 'admin', 'super_admin'],
  'the roles, from the lowest rank to the highest');
select is(
  (select array_agg(rank order by rank) from public.roles where key in ('user', 'manager', 'moderator', 'admin', 'super_admin')),
  array[10, 20, 30, 40, 100],
  'the existing ranks did not move');
select is(
  (select array_agg(label order by rank) from public.roles where key in ('relay', 'editor', 'developer')),
  array['Relais', 'Rédacteur', 'Développeur'],
  'the new roles have their French labels');

-- What each new role holds, and nothing more.
select is(
  (select array_agg(permission order by permission) from public.role_permissions where role = 'developer'),
  array['audit.read', 'monitoring.view', 'statistics.view'],
  'developer reads health, statistics and the audit log');
select is(
  (select array_agg(permission) from public.role_permissions where role = 'editor'),
  array['announcement.publish'],
  'editor only publishes announcements');
select is(
  (select array_agg(permission) from public.role_permissions where role = 'relay'),
  array['map.position.declare'],
  'relay only declares the position');

-- has_permission(): developer.
select is(public.has_permission('00000000-0000-0000-0000-0000000000f1', 'monitoring.view'), true, 'developer: monitoring.view');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f1', 'statistics.view'), true, 'developer: statistics.view');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f1', 'user.ban'), false, 'developer cannot ban');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f1', 'role.assign'), false, 'developer cannot assign roles');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f1', 'permission.manage'), false, 'developer cannot manage permissions');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f1', 'user.origin.view'), false, 'developer does not see where users signed up from');
-- editor and relay do not hold each other's tools.
select is(public.has_permission('00000000-0000-0000-0000-0000000000f2', 'map.route.edit'), false, 'editor cannot edit the route');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f2', 'map.position.declare'), false, 'editor cannot declare the position');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f3', 'announcement.publish'), false, 'relay cannot publish');
select is(public.has_permission('00000000-0000-0000-0000-0000000000f3', 'map.route.edit'), false, 'relay cannot edit the route');

-- An audit entry to read (inserted as the table owner).
insert into public.audit_logs (actor_id, action) values (null, 'test.entry');

-- Developer in action: reads the monitoring and statistics, cannot touch accounts.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';
select lives_ok($$select * from public.health_stats()$$, 'developer reads the health counters');
select lives_ok($$select * from public.stats_overview()$$, 'developer reads the statistics');
select is((select count(*)::int from public.audit_logs where action = 'test.entry'), 1, 'developer reads the audit log');
select throws_ok(
  $$select public.ban_user('00000000-0000-0000-0000-0000000000f5', 'test', null)$$,
  '42501', null, 'developer cannot ban');
select throws_ok(
  $$select public.assign_role('00000000-0000-0000-0000-0000000000f5', 'manager')$$,
  '42501', null, 'developer cannot assign a role');

-- Editor: publishes, but has no map tool.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated"}';
select lives_ok(
  $$insert into public.announcements (title, body, author_id) values ('t', 'b', '00000000-0000-0000-0000-0000000000f2')$$,
  'editor publishes an announcement');
select throws_ok(
  $$select public.declare_map_position(2.35, 48.85, 'x')$$,
  '42501', null, 'editor cannot declare the position');

-- Relay: declares the position, cannot publish.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated"}';
select lives_ok($$select public.declare_map_position(2.35, 48.85, 'Place')$$, 'relay declares the position');
select throws_ok(
  $$insert into public.announcements (title, body, author_id) values ('t', 'b', '00000000-0000-0000-0000-0000000000f3')$$,
  '42501', null, 'relay cannot publish an announcement');

-- Hierarchy: an admin (40) gives the new roles to lower accounts, never a role at or above their own.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated"}';
select lives_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000f5', 'developer')$$, 'an admin assigns developer');
select lives_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000f5', 'relay')$$, 'an admin assigns relay');
select throws_ok(
  $$select public.assign_role('00000000-0000-0000-0000-0000000000f5', 'admin')$$,
  '42501', null, 'an admin cannot assign admin');
select lives_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000f1', 'user')$$, 'an admin can demote a developer (35 < 40)');

-- A moderator (30) ranks below a developer (35): no action on them, and no role assignment at all.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f6", "role": "authenticated"}';
select throws_ok(
  $$select public.assign_role('00000000-0000-0000-0000-0000000000f2', 'user')$$,
  '42501', null, 'a moderator cannot assign roles');

-- The tables stay read-only for clients.
select throws_ok(
  $$insert into public.roles (key, label, rank) values ('rogue', 'Rogue', 99)$$,
  '42501', null, 'a client cannot create a role');
select throws_ok(
  $$insert into public.role_permissions (role, permission) values ('relay', 'user.ban')$$,
  '42501', null, 'a client cannot grant a permission to a role');

select * from finish();
rollback;
