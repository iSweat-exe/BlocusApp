-- A-015: every table of the public schema must have RLS enabled.
begin;
select plan(1);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'all public tables have RLS enabled'
);

select * from finish();
rollback;
