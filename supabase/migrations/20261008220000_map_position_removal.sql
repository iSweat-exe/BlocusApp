-- A declared position can be removed when it is no longer current (the demonstration moved on or ended).
-- Removal is a soft delete: the row stays in the history, flagged as removed, and the map shows no current
-- position (the newest declaration decides, so an older one never comes back by surprise).
-- Who may remove: the person who declared it, or anyone with map.position.remove (a safety valve for a
-- position left behind by someone who is absent).

alter table public.map_positions
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null;

comment on column public.map_positions.removed_at is
  'Set when the position was removed (no longer current); null while it stands.';

insert into public.permissions (key, description) values
  ('map.position.remove', 'Remove any declared position of the demonstration, not only your own');
insert into public.role_permissions (role, permission) values ('admin', 'map.position.remove');

-- removed_at / removed_by are not writable by clients: they only change through remove_map_position().
create function public.remove_map_position(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  position_row public.map_positions;
begin
  if caller is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into position_row from public.map_positions m where m.id = p_id for update;
  if not found then
    raise exception 'unknown_position' using errcode = '22023';
  end if;

  -- The author (still allowed to declare) or a holder of map.position.remove.
  if not (
    (position_row.author_id = caller and public.has_permission(caller, 'map.position.declare'))
    or public.has_permission(caller, 'map.position.remove')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Idempotent: removing twice leaves one audit entry.
  if position_row.removed_at is not null then
    return;
  end if;

  update public.map_positions
     set removed_at = clock_timestamp(), removed_by = caller
   where id = p_id;

  perform public.write_audit(
    'map.position_removed', position_row.author_id,
    jsonb_build_object('label', position_row.label, 'own', position_row.author_id = caller)
  );
end;
$$;

revoke execute on function public.remove_map_position(uuid) from public, anon;
grant execute on function public.remove_map_position(uuid) to authenticated;
