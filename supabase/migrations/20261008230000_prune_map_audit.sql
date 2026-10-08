-- Quota hygiene (free tier: 500 MB database): the audit log grows without bound, and two of its actions are
-- written often. Every declared position of a demonstration (declare_map_position) and every saved route
-- (save_map_route) adds a row, although the tables themselves keep only the last 200 positions / 20 route
-- versions. About 600 declarations a day during events is ~220 000 rows (50 to 80 MB with its 5 indexes) a year.
-- Administrative actions (roles, permissions, sanctions, events...) are rare and stay forever.
--
-- Retention: map journal entries older than 90 days are deleted, a little at each new map entry (so the cost is
-- paid by the activity that creates the rows, with no cron job or extension to enable: nothing to break the
-- migration pipeline). At most 500 rows per call keep each insert fast, which is plenty because every call
-- also adds a row.

create function public.prune_map_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  newest_expired bigint;
begin
  -- Ids grow with time, so "an id at or below the newest expired row" is an index range scan on
  -- audit_logs_action_idx (action, id desc): it never walks the recent rows.
  select a.id into newest_expired
    from public.audit_logs a
   where a.created_at < now() - interval '90 days'
   order by a.created_at desc, a.id desc
   limit 1;

  if newest_expired is not null then
    delete from public.audit_logs
     where id in (
       select a.id
         from public.audit_logs a
        where a.action in ('map.position_declared', 'map.route_saved')
          and a.id <= newest_expired
          -- Belt and braces: never delete a row that is not expired, whatever its id.
          and a.created_at < now() - interval '90 days'
        order by a.id
        limit 500
     );
  end if;
  return null;
end;
$$;

revoke execute on function public.prune_map_audit() from public, anon, authenticated;

create trigger audit_logs_prune_map
  after insert on public.audit_logs
  for each row
  when (new.action in ('map.position_declared', 'map.route_saved'))
  execute function public.prune_map_audit();
