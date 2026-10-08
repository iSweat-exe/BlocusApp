-- A-126a / A-126b: the route of the demonstration, drawn on the map.
-- A route is a line of [longitude, latitude] points. It is saved as a new immutable version each time
-- (the last 20 are kept, so a bad edit can be undone later); the current route is the newest version.
-- Readable by everybody (Guests included), written only through save_map_route() with map.route.edit.

-- A valid route is empty (no route) or has 2 to 500 points, each [lng, lat] inside the world bounds.
create function public.is_valid_route(p_points jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(p_points) = 'array'
    and (jsonb_array_length(p_points) = 0 or jsonb_array_length(p_points) between 2 and 500)
    and not exists (
      select 1
        from jsonb_array_elements(p_points) as point
       where jsonb_typeof(point) <> 'array'
          or jsonb_array_length(point) <> 2
          or jsonb_typeof(point -> 0) <> 'number'
          or jsonb_typeof(point -> 1) <> 'number'
          or (point ->> 0)::numeric not between -180 and 180
          or (point ->> 1)::numeric not between -90 and 90
    );
$$;

create table public.map_route_versions (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) when the author's account is deleted: the route stays.
  author_id uuid references public.profiles (id) on delete set null,
  points jsonb not null constraint map_route_versions_points_valid check (public.is_valid_route(points)),
  point_count int generated always as (jsonb_array_length(points)) stored,
  created_at timestamptz not null default now()
);

comment on table public.map_route_versions is
  'Versions of the demonstration route (newest = current). Written by save_map_route() only.';

create index map_route_versions_newest_idx on public.map_route_versions (created_at desc, id desc);

alter table public.map_route_versions enable row level security;

revoke all on public.map_route_versions from anon, authenticated;
grant select on public.map_route_versions to anon, authenticated;

create policy "map_route_versions_select_public" on public.map_route_versions
  for select to anon, authenticated
  using (true);

-- No insert/update/delete policy: versions are only created (and the oldest pruned) by save_map_route().

-- Saves the route as a new version. Needs map.route.edit. p_base is the id of the version the editor started
-- from (null when there was none): if somebody saved in the meantime the call fails with 'stale_route' instead
-- of silently overwriting their work.
create function public.save_map_route(p_points jsonb, p_base uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  latest uuid;
  new_id uuid;
begin
  if caller is null or not public.has_permission(caller, 'map.route.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not public.is_valid_route(p_points) then
    raise exception 'invalid_route' using errcode = '22023';
  end if;

  -- Two simultaneous saves must not both pass the staleness check.
  perform pg_advisory_xact_lock(hashtext('map_route_versions'));

  select v.id into latest
    from public.map_route_versions v
   order by v.created_at desc, v.id desc
   limit 1;
  if latest is distinct from p_base then
    raise exception 'stale_route' using errcode = '40001';
  end if;

  insert into public.map_route_versions (author_id, points, created_at)
  values (caller, p_points, clock_timestamp())
  returning id into new_id;

  -- Keep the 20 newest versions.
  delete from public.map_route_versions
   where id not in (
     select v.id from public.map_route_versions v order by v.created_at desc, v.id desc limit 20
   );

  perform public.write_audit('map.route_saved', null, jsonb_build_object('points', jsonb_array_length(p_points)));
  return new_id;
end;
$$;

revoke execute on function public.save_map_route(jsonb, uuid) from public, anon;
grant execute on function public.save_map_route(jsonb, uuid) to authenticated;
