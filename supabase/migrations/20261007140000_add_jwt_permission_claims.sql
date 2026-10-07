-- A-034: Custom Access Token Hook. Adds the user's role and permissions to the JWT so that
-- permission checks need no database round trip. Claims refresh with the token (<= jwt_expiry):
-- RLS (has_permission) stays authoritative, the claims are only a fast path for the server.

create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  user_role text;
  user_permissions jsonb;
begin
  claims := event -> 'claims';

  select p.role into user_role
    from public.profiles p
   where p.id = (event ->> 'user_id')::uuid;

  if user_role is null then
    return event;
  end if;

  -- super_admin holds every catalogued permission (same rule as has_permission()).
  select coalesce(jsonb_agg(granted.key order by granted.key), '[]'::jsonb)
    into user_permissions
    from (
      select rp.permission as key
        from public.role_permissions rp
       where rp.role = user_role and user_role <> 'super_admin'
      union
      select pe.key
        from public.permissions pe
       where user_role = 'super_admin'
    ) granted;

  -- "role" is reserved by Postgres/PostgREST, so the application role gets its own claim.
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{permissions}', user_permissions);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Only Supabase Auth may call the hook; clients must never run it.
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
