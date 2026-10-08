-- touch_permission_epoch() bumped the single epoch row with an UPDATE that has no WHERE clause. Supabase loads
-- the `pg-safeupdate` extension for requests that come through the API (PostgREST), and it rejects any UPDATE or
-- DELETE without a WHERE clause, even inside a function: "UPDATE requires a WHERE clause" (21000). Every change
-- that bumps the epoch through the API failed: assigning a role, granting a permission, banning a user.
-- A local database does not load the extension, which is why the tests did not catch it.
--
-- Same function, with `where singleton` (the table has one row, `singleton` is always true).

create or replace function public.touch_permission_epoch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.permission_epoch set changed_at = clock_timestamp() where singleton;
  return null;
end;
$$;
