-- A-135b: Web Push subscriptions (one row per browser / installed app of a signed-in user).
--
-- A subscription is a capability URL (the push service endpoint) plus the keys that encrypt the message: whoever
-- holds it can push to that device, so the table is closed to clients entirely. They save and remove their own
-- subscription through two functions; the server reads every row with the service role to send a notification.
--
-- The endpoint is where the server will POST, so a client must not be able to make it call an arbitrary address:
-- it has to be one of the push services of the browsers (Chrome / Android, Safari / iOS, Firefox, Edge).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null
    constraint push_subscriptions_endpoint_length check (char_length(endpoint) between 20 and 2048)
    constraint push_subscriptions_endpoint_host check (
      endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)/[^[:space:]]*$'
    ),
  -- Client public key (P-256, base64url, 65 bytes) and authentication secret (base64url, 16 bytes).
  p256dh text not null constraint push_subscriptions_p256dh_format check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null constraint push_subscriptions_auth_format check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  created_at timestamptz not null default now(),
  -- The same browser can be used by another account later: the endpoint identifies the device.
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

comment on table public.push_subscriptions is
  'Web Push subscriptions, one per device. Closed to clients: saved by save_push_subscription(), read by the server.';

create index push_subscriptions_user_idx on public.push_subscriptions (user_id, created_at);

alter table public.push_subscriptions enable row level security;

-- No policy and no grant: a subscription lets its holder push to a device, so it is never readable by a client.
revoke all on public.push_subscriptions from anon, authenticated;

-- Saves the caller's subscription for this device (or moves it to the caller when another account used it before).
-- Needs a signed-in, non-banned user; limited to 20 calls per minute; keeps the 10 most recent devices per user.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or public.is_banned(caller) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.consume_rate_limit('push.write', 20, interval '1 minute');

  insert into public.push_subscriptions as s (user_id, endpoint, p256dh, auth)
  values (caller, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;

  delete from public.push_subscriptions s
   where s.user_id = caller
     and s.id not in (
       select o.id from public.push_subscriptions o
        where o.user_id = caller
        order by o.created_at desc, o.id desc
        limit 10
     );
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Removes the caller's subscription of this device. Nothing happens for an endpoint that is not theirs.
create function public.remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.consume_rate_limit('push.write', 20, interval '1 minute');

  delete from public.push_subscriptions s where s.endpoint = p_endpoint and s.user_id = caller;
end;
$$;

revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.remove_push_subscription(text) to authenticated;
