begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev',
   '{"user_name": "Alice#1", "avatar_url": "https://cdn.example/a.png"}'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev',
   '{"user_name": "alice1"}'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.dev', '{}');

select is((select pseudo from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Alice1',
  'trigger creates a sanitized profile');
select isnt((select pseudo from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'alice1',
  'pseudo collision gets a suffix');
select is((select pseudo from public.profiles where id = '00000000-0000-0000-0000-0000000000c3'), 'user',
  'fallback pseudo when the provider gives none');

-- anon: no access.
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');

-- authenticated as Alice.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select is((select count(*)::int from public.profiles), 3, 'authenticated can read all profiles');

update public.profiles set pseudo = 'AliceNew' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select pseudo from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'AliceNew',
  'user can update their own pseudo');

update public.profiles set pseudo = 'Hacked' where id = '00000000-0000-0000-0000-0000000000b2';
select isnt((select pseudo from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 'Hacked',
  'user cannot update another profile');

select throws_ok(
  $$update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'user cannot update non-granted columns');
select throws_ok(
  $$update public.profiles set pseudo = 'x' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'pseudo format is enforced');
select throws_ok(
  $$insert into public.profiles (id, pseudo) values (gen_random_uuid(), 'Intruder')$$,
  '42501', null, 'user cannot insert profiles');
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'user cannot delete profiles');

select * from finish();
rollback;
