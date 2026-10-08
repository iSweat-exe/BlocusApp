-- The epoch moves whenever an input of the JWT claims changes, and only then.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u@test.dev', '{"user_name": "plain_user"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@test.dev', '{"user_name": "the_manager"}');

-- Move the epoch far back so that any bump is visible, even inside one transaction.
create function pg_temp.reset_epoch() returns void language sql as $$
  update public.permission_epoch set changed_at = timestamptz '2000-01-01'
$$;
create function pg_temp.moved() returns boolean language sql as $$
  select public.get_permission_epoch() > timestamptz '2000-01-01'
$$;

select pg_temp.reset_epoch();
update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a2';
select ok(pg_temp.moved(), 'a role change moves the epoch');

select pg_temp.reset_epoch();
update public.profiles set pseudo = 'renamed_user' where id = '00000000-0000-0000-0000-0000000000a1';
select ok(not pg_temp.moved(), 'a profile edit that is not a role change does not');

select pg_temp.reset_epoch();
insert into public.permission_overrides (user_id, permission, effect)
values ('00000000-0000-0000-0000-0000000000a1', 'announcement.publish', 'grant');
select ok(pg_temp.moved(), 'granting a permission to one user moves the epoch');

select pg_temp.reset_epoch();
delete from public.permission_overrides where user_id = '00000000-0000-0000-0000-0000000000a1';
select ok(pg_temp.moved(), 'clearing an override moves the epoch');

select pg_temp.reset_epoch();
insert into public.role_permissions (role, permission) values ('moderator', 'event.create');
select ok(pg_temp.moved(), 'editing the role matrix moves the epoch');

select pg_temp.reset_epoch();
insert into public.permissions (key, description) values ('test.new_permission', 'For the epoch test');
select ok(pg_temp.moved(), 'adding a permission to the catalogue moves the epoch');

select pg_temp.reset_epoch();
select ok(not pg_temp.moved(), 'nothing moves it by itself');

-- Everybody may read the timestamp; nobody may touch the table.
set local role anon;
select isnt(public.get_permission_epoch(), null, 'anon can read the epoch');
select throws_ok($$update public.permission_epoch set changed_at = now()$$, '42501', null,
  'anon cannot write the table');

-- Supabase's pg-safeupdate rejects an UPDATE without WHERE, even inside a function, for requests that come
-- through the API (a local database does not load it): the bump must keep its WHERE clause.
select matches(
  pg_get_functiondef('public.touch_permission_epoch()'::regprocedure),
  'where\s+singleton',
  'the epoch bump has a WHERE clause (pg-safeupdate)');

select * from finish();
rollback;
