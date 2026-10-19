-- Chrome Beta / Dev / Canary (also on Android) register their push subscription through the staging FCM host
-- `jmt17.google.com` instead of `fcm.googleapis.com`: the check below refused them, so notifications could not be
-- turned on. The host is added by exact name (never `*.google.com`: the server POSTs to this address, so any other
-- Google host would let a client aim the server at a service it does not control).
--
-- The new pattern is a superset of the old one, so every stored row still satisfies it.

alter table public.push_subscriptions
  drop constraint push_subscriptions_endpoint_host,
  add constraint push_subscriptions_endpoint_host check (
    endpoint ~ '^https://(fcm\.googleapis\.com|jmt17\.google\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)/[^[:space:]]*$'
  );
