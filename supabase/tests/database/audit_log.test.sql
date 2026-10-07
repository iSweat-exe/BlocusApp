begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';

delete from public.audit_logs;

-- An admin changes a role: the change is journaled.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select public.assign_role('00000000-0000-0000-0000-0000000000a1', 'manager');

select is((select count(*)::int from public.audit_logs), 1, 'admin can read the audit log (one entry)');
select is(
  (select jsonb_build_object('actor', actor_id, 'action', action, 'target', target_id, 'details', details)
     from public.audit_logs),
  jsonb_build_object(
    'actor', '00000000-0000-0000-0000-0000000000a4',
    'action', 'role.assigned',
    'target', '00000000-0000-0000-0000-0000000000a1',
    'details', jsonb_build_object('from', 'user', 'to', 'manager')
  ),
  'the entry records actor, action, target and the role change');

-- A failed change leaves no entry.
select throws_ok($$select public.assign_role('00000000-0000-0000-0000-0000000000a4', 'user')$$,
  '42501', 'hierarchy_violation', 'a refused change raises');
select is((select count(*)::int from public.audit_logs), 1, 'a refused change is not journaled');

-- Clients cannot write the log, nor call the internal writer.
select throws_ok(
  $$insert into public.audit_logs (actor_id, action) values (null, 'fake.entry')$$,
  '42501', null, 'clients cannot insert into the audit log');
select throws_ok(
  $$select public.write_audit('fake.entry', null, '{}'::jsonb)$$,
  '42501', null, 'clients cannot call write_audit');

-- A manager has no audit.read: the table looks empty.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select is((select count(*)::int from public.audit_logs), 0, 'a role without audit.read sees nothing');

-- anon has no access at all.
set local role anon;
select throws_ok('select * from public.audit_logs', '42501', null, 'anon cannot read the audit log');

reset role;
select ok(
  exists (select 1 from public.role_permissions where role = 'admin' and permission = 'audit.read'),
  'admin holds audit.read');

select * from finish();
rollback;
