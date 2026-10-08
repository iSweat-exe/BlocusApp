-- Retention of the map journal: entries of declared positions and saved routes older than 90 days are pruned when a
-- new one is written; administrative entries are never pruned.
begin;
select plan(7);

delete from public.audit_logs;

alter table public.audit_logs disable trigger audit_logs_prune_map;
insert into public.audit_logs (action, created_at) values
  ('map.position_declared', now() - interval '120 days'),
  ('map.route_saved',       now() - interval '91 days'),
  ('role.assigned',         now() - interval '200 days'),
  ('map.position_declared', now() - interval '89 days'),
  ('map.position_declared', now() - interval '1 day');
alter table public.audit_logs enable trigger audit_logs_prune_map;

-- An administrative entry does not trigger any pruning.
insert into public.audit_logs (action) values ('role.assigned');
select is((select count(*)::int from public.audit_logs), 6, '1. an administrative entry prunes nothing');

-- A new map entry prunes the expired map entries, and only those.
insert into public.audit_logs (action) values ('map.position_declared');
select is((select count(*)::int from public.audit_logs where action like 'map.%' and created_at < now() - interval '90 days'), 0,
  '2. expired map entries are gone');
select is((select count(*)::int from public.audit_logs where action = 'role.assigned'), 2,
  '3. administrative entries are kept, even the oldest');
select is((select count(*)::int from public.audit_logs where action like 'map.%'), 3,
  '4. recent map entries are kept (89 days, 1 day, and the new one)');

-- At most 500 rows are removed per new entry.
alter table public.audit_logs disable trigger audit_logs_prune_map;
insert into public.audit_logs (action, created_at)
select 'map.position_declared', now() - interval '150 days' from generate_series(1, 1200);
alter table public.audit_logs enable trigger audit_logs_prune_map;
insert into public.audit_logs (action) values ('map.position_declared');
select is((select count(*)::int from public.audit_logs where action like 'map.%' and created_at < now() - interval '90 days'), 700,
  '5. a call removes at most 500 expired entries');

-- The pruning function is internal.
select is(has_function_privilege('anon', 'public.prune_map_audit()', 'execute'), false,
  '6. anon cannot run the pruning function');
select is(has_function_privilege('authenticated', 'public.prune_map_audit()', 'execute'), false,
  '7. nor can a signed-in user');

select * from finish();
rollback;
