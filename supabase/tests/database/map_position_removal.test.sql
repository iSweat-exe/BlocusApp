-- A declared position can be removed by its author, or by a holder of map.position.remove. Soft delete.
begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "manager_one"}'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm2@test.dev', '{"user_name": "manager_two"}'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev', '{"user_name": "the_admin"}');

update public.profiles set role = 'manager' where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a4';
delete from public.audit_logs;

select ok(exists (select 1 from public.permissions where key = 'map.position.remove'),
  '1. the map.position.remove permission exists');
select ok(public.has_permission('00000000-0000-0000-0000-0000000000a4', 'map.position.remove'),
  '2. administrators hold it');
select ok(not public.has_permission('00000000-0000-0000-0000-0000000000a2', 'map.position.remove'),
  '3. managers do not');

-- Manager one declares two positions.
insert into public.map_positions (id, author_id, lng, lat, label) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a2', 2.3, 48.8, 'Gare'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a2', 2.4, 48.9, 'Place');

-- Somebody else (another manager, a plain user) cannot remove it.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok($$select public.remove_map_position('00000000-0000-0000-0000-00000000c002')$$, '42501', 'forbidden',
  '4. another manager cannot remove it');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$select public.remove_map_position('00000000-0000-0000-0000-00000000c002')$$, '42501', 'forbidden',
  '5. a plain user cannot remove it');
reset role;

-- The author can; the row stays, flagged.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok($$select public.remove_map_position('00000000-0000-0000-0000-00000000c002')$$,
  '6. the author removes their own position');
select lives_ok($$select public.remove_map_position('00000000-0000-0000-0000-00000000c002')$$,
  '7. removing twice is harmless');
select throws_ok($$select public.remove_map_position(gen_random_uuid())$$, '22023', 'unknown_position',
  '8. an unknown position is refused');
reset role;

select is((select removed_by from public.map_positions where id = '00000000-0000-0000-0000-00000000c002'),
  '00000000-0000-0000-0000-0000000000a2'::uuid, '9. the row is kept, with who removed it');
select is((select count(*)::int from public.audit_logs where action = 'map.position_removed'), 1,
  '10. exactly one removal is journaled');

-- An administrator can remove somebody else's.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select lives_ok($$select public.remove_map_position('00000000-0000-0000-0000-00000000c001')$$,
  '11. a holder of map.position.remove removes another person''s position');
reset role;

-- Guests read removed rows too (they are flagged, not hidden) but cannot write.
set local role anon;
select is((select count(*)::int from public.map_positions where removed_at is not null), 2,
  '12. the history stays readable, flagged');
select throws_ok($$select public.remove_map_position('00000000-0000-0000-0000-00000000c001')$$, '42501', null,
  '13. a Guest cannot remove anything');
reset role;

select * from finish();
rollback;
