-- A-113: right of access and portability (GDPR articles 15 and 20). One function gives a signed-in user everything
-- the application holds about them, as one JSON document. It reads tables that are closed to clients (the signup
-- origin, the last activity, the sanctions), hence SECURITY DEFINER, and only ever returns the caller's own rows:
-- the user id comes from the JWT (`auth.uid()`), never from an argument.
--
-- Not included on purpose: the push keys (`p256dh`, `auth`) are secrets of the browser, only the host of the push
-- service is shown; the audit log is not exported (it describes administrators' actions, with other people's ids).

create function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'providers', u.raw_app_meta_data -> 'providers'
      )
      from auth.users u
      where u.id = caller
    ),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = caller),
    'permission_overrides', coalesce((
      select jsonb_agg(
        jsonb_build_object('permission', o.permission, 'effect', o.effect, 'created_at', o.created_at)
        order by o.created_at)
      from public.permission_overrides o
      where o.user_id = caller
    ), '[]'::jsonb),
    'signup_origin', (
      select jsonb_build_object('country', s.country, 'region', s.region, 'city', s.city, 'created_at', s.created_at)
      from public.signup_origins s
      where s.user_id = caller
    ),
    'last_seen_at', (select a.last_seen_at from public.user_activity a where a.user_id = caller),
    'announcements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', n.id, 'title', n.title, 'body', n.body, 'status', n.status, 'show_author', n.show_author,
          'image_path', n.image_path, 'created_at', n.created_at, 'edited_at', n.edited_at)
        order by n.created_at)
      from public.announcements n
      where n.author_id = caller
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id, 'title', e.title, 'description', e.description, 'location', e.location,
          'starts_at', e.starts_at, 'ends_at', e.ends_at, 'created_at', e.created_at)
        order by e.created_at)
      from public.events e
      where e.author_id = caller
    ), '[]'::jsonb),
    'map_positions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id, 'label', m.label, 'lng', m.lng, 'lat', m.lat, 'declared_at', m.declared_at,
          'removed_at', m.removed_at)
        order by m.declared_at)
      from public.map_positions m
      where m.author_id = caller
    ), '[]'::jsonb),
    'reactions', coalesce((
      select jsonb_agg(
        jsonb_build_object('announcement_id', r.announcement_id, 'emoji', r.emoji, 'created_at', r.created_at)
        order by r.created_at)
      from public.announcement_reactions r
      where r.user_id = caller
    ), '[]'::jsonb),
    'push_subscriptions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'push_service', substring(s.endpoint from '^https://([^/]+)'), 'created_at', s.created_at)
        order by s.created_at)
      from public.push_subscriptions s
      where s.user_id = caller
    ), '[]'::jsonb),
    'sanctions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', x.kind, 'reason', x.reason, 'created_at', x.created_at, 'expires_at', x.expires_at,
          'revoked_at', x.revoked_at)
        order by x.created_at)
      from public.moderation_actions x
      where x.target_id = caller
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
