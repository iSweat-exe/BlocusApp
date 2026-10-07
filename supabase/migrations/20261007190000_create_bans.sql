-- A-051 / A-053 / A-054: sanctions. Only bans have behaviour for now; the table already accepts
-- 'mute' so the messaging step does not need a schema change (its RPC will come with that step).

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  -- Plain id (no foreign key): the history survives the deletion of the sanctioned account.
  target_id uuid not null,
  kind text not null constraint moderation_actions_kind check (kind in ('ban', 'mute')),
  reason text not null
    constraint moderation_actions_reason_length check (char_length(reason) between 1 and 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  -- null = permanent. Expiry is evaluated when read (no cron job): see is_banned().
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  constraint moderation_actions_expiry_after_creation check (expires_at is null or expires_at > created_at)
);

comment on table public.moderation_actions is 'Bans (and later mutes). Active = not revoked and not expired.';

create index moderation_actions_target_idx on public.moderation_actions (target_id, created_at desc);
create index moderation_actions_feed_idx on public.moderation_actions (created_at desc, id desc);

-- True while the user has an active ban. Internal: called by other SECURITY DEFINER functions.
create function public.is_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.moderation_actions m
     where m.target_id = p_user_id
       and m.kind = 'ban'
       and m.revoked_at is null
       and (m.expires_at is null or m.expires_at > now())
  );
$$;

revoke execute on function public.is_banned(uuid) from public, anon, authenticated;

-- A banned user holds no permission at all.
create or replace function public.effective_permissions(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_banned(p_user_id) then '{}'::text[]
    else (
      select coalesce(array_agg(x.key order by x.key), '{}'::text[])
      from (
        select pe.key
          from public.permissions pe
          join public.profiles p on p.id = p_user_id and p.role = 'super_admin'
        union
        select rp.permission
          from public.role_permissions rp
          join public.profiles p on p.id = p_user_id and p.role = rp.role and p.role <> 'super_admin'
        union
        select o.permission
          from public.permission_overrides o
          join public.profiles p on p.id = o.user_id and p.role <> 'super_admin'
         where o.user_id = p_user_id and o.effect = 'grant'
      ) x
      where not exists (
        select 1
          from public.permission_overrides d
          join public.profiles p on p.id = d.user_id and p.role <> 'super_admin'
         where d.user_id = p_user_id and d.effect = 'deny' and d.permission = x.key
      )
    )
  end;
$$;

-- The JWT hook refuses to issue a token to a banned user (sign-in and token refresh both fail).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  uid uuid := (event ->> 'user_id')::uuid;
  user_role text;
begin
  if public.is_banned(uid) then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'account_banned')
    );
  end if;

  claims := event -> 'claims';

  select p.role into user_role from public.profiles p where p.id = uid;
  if user_role is null then
    return event;
  end if;

  -- "role" is reserved by Postgres/PostgREST, so the application role gets its own claim.
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{permissions}', to_jsonb(public.effective_permissions(uid)));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Bans a user (permanently when p_expires_at is null) and signs them out everywhere.
-- Needs user.ban, a target ranking strictly below the caller, and no active ban already.
create function public.ban_user(p_target uuid, p_reason text, p_expires_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_rank int;
  target_rank int;
  reason text := btrim(coalesce(p_reason, ''));
  new_id uuid;
begin
  if caller is null or not public.has_permission(caller, 'user.ban') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(reason) not between 1 and 500 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;

  select public.role_rank(p.role) into target_rank from public.profiles p where p.id = p_target;
  if target_rank is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;
  select public.role_rank(p.role) into caller_rank from public.profiles p where p.id = caller;
  if p_target = caller or caller_rank is null or target_rank >= caller_rank then
    raise exception 'hierarchy_violation' using errcode = '42501';
  end if;
  if public.is_banned(p_target) then
    raise exception 'already_banned' using errcode = '23505';
  end if;

  insert into public.moderation_actions (target_id, kind, reason, created_by, expires_at)
  values (p_target, 'ban', reason, caller, p_expires_at)
  returning id into new_id;

  -- Immediate effect: end every session. The access token still in flight carries no permission
  -- (effective_permissions is empty) and cannot be refreshed (the hook refuses it).
  delete from auth.refresh_tokens where user_id = p_target::text;
  delete from auth.sessions where user_id = p_target;

  perform public.write_audit(
    'user.banned',
    p_target,
    jsonb_build_object('reason', reason, 'expires_at', p_expires_at, 'sanction_id', new_id)
  );
  return new_id;
end;
$$;

revoke execute on function public.ban_user(uuid, text, timestamptz) from public, anon;
grant execute on function public.ban_user(uuid, text, timestamptz) to authenticated;

-- Lifts an active sanction early. Same permission and hierarchy rules as applying it.
create function public.revoke_sanction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  sanction public.moderation_actions;
  caller_rank int;
  target_rank int;
begin
  select * into sanction from public.moderation_actions where id = p_id;
  if sanction.id is null then
    raise exception 'unknown_sanction' using errcode = '22023';
  end if;

  if caller is null or not public.has_permission(
       caller, case sanction.kind when 'ban' then 'user.ban' else 'user.mute' end
     ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select public.role_rank(p.role) into target_rank from public.profiles p where p.id = sanction.target_id;
  select public.role_rank(p.role) into caller_rank from public.profiles p where p.id = caller;
  if caller_rank is null or (target_rank is not null and target_rank >= caller_rank) then
    raise exception 'hierarchy_violation' using errcode = '42501';
  end if;

  if sanction.revoked_at is not null or (sanction.expires_at is not null and sanction.expires_at <= now()) then
    raise exception 'not_active' using errcode = '22023';
  end if;

  update public.moderation_actions set revoked_at = now(), revoked_by = caller where id = p_id;

  perform public.write_audit(
    'sanction.revoked',
    sanction.target_id,
    jsonb_build_object('sanction_id', p_id, 'kind', sanction.kind)
  );
end;
$$;

revoke execute on function public.revoke_sanction(uuid) from public, anon;
grant execute on function public.revoke_sanction(uuid) to authenticated;

-- RLS: moderators and admins can read sanctions; nobody writes directly.
alter table public.moderation_actions enable row level security;

revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

create policy "moderation_actions_select_moderators" on public.moderation_actions
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'user.ban'))
    or (select public.has_permission((select auth.uid()), 'user.mute'))
  );
