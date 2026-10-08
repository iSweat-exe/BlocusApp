-- A-126c / A-127: the declared position of the demonstration.
-- A manager declares where the demonstration is now (a point and a time); the newest declaration is the current
-- position and the last 200 are kept as history. Only declared positions exist here: the position of ordinary
-- users is never stored. Readable by everybody (Guests included), written only through declare_map_position()
-- with map.position.declare.

create table public.map_positions (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) when the author's account is deleted: the history stays.
  author_id uuid references public.profiles (id) on delete set null,
  lng double precision not null constraint map_positions_lng_range check (lng between -180 and 180),
  lat double precision not null constraint map_positions_lat_range check (lat between -90 and 90),
  -- Optional free text such as "Place de la République".
  label text not null default '' constraint map_positions_label_length check (char_length(label) <= 80),
  declared_at timestamptz not null default now()
);

comment on table public.map_positions is
  'Declared positions of the demonstration (newest = current). Written by declare_map_position() only.';

create index map_positions_newest_idx on public.map_positions (declared_at desc, id desc);

alter table public.map_positions enable row level security;

revoke all on public.map_positions from anon, authenticated;
grant select on public.map_positions to anon, authenticated;

create policy "map_positions_select_public" on public.map_positions
  for select to anon, authenticated
  using (true);

-- No insert/update/delete policy: positions are only created (and the oldest pruned) by declare_map_position().

-- Declares the current position. Needs map.position.declare. At most one declaration every 5 seconds per user
-- (anti-flood, A-104), 'rate_limited' otherwise. Journaled.
create function public.declare_map_position(p_lng double precision, p_lat double precision, p_label text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  clean_label text := btrim(coalesce(p_label, ''));
  new_id uuid;
begin
  if caller is null or not public.has_permission(caller, 'map.position.declare') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_lng is null or p_lat is null
     or p_lng not between -180 and 180 or p_lat not between -90 and 90
     or char_length(clean_label) > 80 then
    raise exception 'invalid_position' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.map_positions m
     where m.author_id = caller and m.declared_at > clock_timestamp() - interval '5 seconds'
  ) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.map_positions (author_id, lng, lat, label, declared_at)
  values (caller, p_lng, p_lat, clean_label, clock_timestamp())
  returning id into new_id;

  -- Keep the 200 newest declarations.
  delete from public.map_positions
   where id not in (
     select m.id from public.map_positions m order by m.declared_at desc, m.id desc limit 200
   );

  perform public.write_audit(
    'map.position_declared', null,
    jsonb_build_object('label', clean_label, 'lng', round(p_lng::numeric, 5), 'lat', round(p_lat::numeric, 5))
  );
  return new_id;
end;
$$;

revoke execute on function public.declare_map_position(double precision, double precision, text) from public, anon;
grant execute on function public.declare_map_position(double precision, double precision, text) to authenticated;
