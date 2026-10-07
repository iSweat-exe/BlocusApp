begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's@test.dev', '{"user_name": "the_super"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a5';

create function pg_temp.claims_for(p_user uuid) returns jsonb language sql as $$
  select public.custom_access_token_hook(
    jsonb_build_object('user_id', p_user, 'claims', jsonb_build_object('sub', p_user, 'role', 'authenticated'))
  ) -> 'claims'
$$;

select is(pg_temp.claims_for('00000000-0000-0000-0000-0000000000a1') -> 'permissions', '[]'::jsonb,
  'user gets an empty permission list');
select is(pg_temp.claims_for('00000000-0000-0000-0000-0000000000a2') ->> 'app_role', 'manager',
  'role is exposed as app_role');
select is(pg_temp.claims_for('00000000-0000-0000-0000-0000000000a2') -> 'permissions',
  '["announcement.publish", "map.position.declare", "map.route.edit"]'::jsonb,
  'manager gets exactly its permissions');
select is(jsonb_array_length(pg_temp.claims_for('00000000-0000-0000-0000-0000000000a5') -> 'permissions'),
  (select count(*)::int from public.permissions), 'super_admin gets the whole catalogue');
select is(pg_temp.claims_for('00000000-0000-0000-0000-0000000000a2') ->> 'role', 'authenticated',
  'the reserved role claim is untouched');

-- Only supabase_auth_admin may run the hook.
set local role authenticated;
select throws_ok(
  $$select public.custom_access_token_hook('{}'::jsonb)$$,
  '42501', null, 'authenticated cannot call the hook');

reset role;
select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'supabase_auth_admin can call the hook');

select * from finish();
rollback;
