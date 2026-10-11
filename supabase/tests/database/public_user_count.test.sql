begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.dev', '{"user_name": "count_one"}'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.dev', '{"user_name": "count_two"}');

create temp table before_delete as select count(*)::int as n from public.profiles;
grant select on before_delete to public;

-- A Guest (anon) gets the number of accounts, as an integer.
set local role anon;
select is(public.public_user_count(), (select n from before_delete), 'a Guest reads the number of accounts');
select is(pg_typeof(public.public_user_count())::text, 'integer', 'it is a plain integer');

-- It is the only thing a Guest can learn: the table itself stays closed.
select throws_ok($$select * from public.profiles$$, '42501', null, 'a Guest still cannot read the profiles');

-- A signed-in user gets the same figure.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}';
select is(public.public_user_count(), (select n from before_delete), 'a signed-in user reads it too');

-- It follows the accounts.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e2';
set local role anon;
select is(public.public_user_count(), (select n - 1 from before_delete), 'deleting an account lowers it by one');
select cmp_ok(public.public_user_count(), '>=', 1, 'the account left is counted');

select * from finish();
rollback;
