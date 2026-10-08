-- A-126c: declared positions. Public read, writes only through declare_map_position() with map.position.declare.
begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}');

update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
delete from public.audit_logs;

-- A plain user cannot declare, nor write the table.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.declare_map_position(2.3, 48.8, 'x')$$, '42501', 'forbidden',
  '1. without map.position.declare nothing can be declared');
select throws_ok($$insert into public.map_positions (lng, lat) values (1, 1)$$, '42501', null,
  '2. positions cannot be written directly');
reset role;

-- A manager declares; inputs are validated; the label is trimmed.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok($$select public.declare_map_position(2.3, 98.8, 'x')$$, '22023', 'invalid_position',
  '3. a latitude out of range is refused');
select throws_ok($$select public.declare_map_position(null, 48.8, 'x')$$, '22023', 'invalid_position',
  '4. a missing coordinate is refused');
select throws_ok($$select public.declare_map_position(2.3, 48.8, repeat('a', 81))$$, '22023', 'invalid_position',
  '5. a label over 80 characters is refused');
select lives_ok($$select public.declare_map_position(2.3, 48.8, '  Place  ')$$,
  '6. a manager declares the current position');
select throws_ok($$select public.declare_map_position(2.31, 48.81, 'again')$$, '54000', 'rate_limited',
  '7. a second declaration within 5 seconds is refused');
reset role;

select is((select label from public.map_positions), 'Place', '8. the label is trimmed');
select is((select count(*)::int from public.audit_logs where action = 'map.position_declared'), 1,
  '9. the declaration is journaled once');

-- Everybody reads the position.
set local role anon;
select is((select count(*)::int from public.map_positions), 1, '10. a Guest reads the position');
select throws_ok($$select public.declare_map_position(1, 1, '')$$, '42501', null, '11. a Guest cannot declare');
reset role;

select is((select count(*)::int from public.map_positions where author_id is null), 0,
  '12. the author is recorded');

select * from finish();
rollback;
