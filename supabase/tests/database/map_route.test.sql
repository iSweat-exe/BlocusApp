-- A-126: map route versions. Public read, writes only through save_map_route() with map.route.edit.
begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
delete from public.audit_logs;

-- Validation of the route shape.
select ok(public.is_valid_route('[]'), '1. an empty route is valid (no route)');
select ok(public.is_valid_route('[[2.3, 48.8], [2.4, 48.9]]'), '2. two points are valid');
select ok(not public.is_valid_route('[[2.3, 48.8]]'), '3. a single point is not a route');
select ok(not public.is_valid_route('[[2.3, 148.8], [2.4, 48.9]]'), '4. a latitude out of range is refused');
select ok(not public.is_valid_route('[["a", 1], [2, 3]]'), '5. non-numeric coordinates are refused');

-- A plain user cannot save.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.save_map_route('[[2.3, 48.8], [2.4, 48.9]]')$$, '42501', 'forbidden',
  '6. without map.route.edit the route cannot be saved');
select throws_ok($$insert into public.map_route_versions (points) values ('[]')$$, '42501', null,
  '7. versions cannot be written directly');
reset role;

-- A manager can, and the audit log records it.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok($$select public.save_map_route('[[2.3, 48.8], [2.4, 48.9]]', null)$$,
  '8. a manager saves the first version');
select throws_ok($$select public.save_map_route('[[2.3, 48.8], [2.5, 48.9]]', null)$$, '40001', 'stale_route',
  '9. saving from an out-of-date base is refused');
select throws_ok($$select public.save_map_route('[[2.3, 48.8]]', (select id from public.map_route_versions limit 1))$$,
  '22023', 'invalid_route', '10. an invalid route is refused');
reset role;

select is((select count(*)::int from public.audit_logs where action = 'map.route_saved'), 1,
  '11. exactly one saved version is journaled');

-- Everybody reads the current route.
set local role anon;
select is((select count(*)::int from public.map_route_versions), 1, '12. a Guest reads the route');
select throws_ok($$select public.save_map_route('[]')$$, '42501', null, '13. a Guest cannot call the RPC');
reset role;

select is((select point_count from public.map_route_versions limit 1), 2, '14. point_count is derived from the points');

select * from finish();
rollback;
