/** A Web Push subscription as the browser serializes it (`PushSubscription.toJSON()`), checked. */
export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Hosts of the push services of the browsers: Chrome and Android (FCM), Firefox (autopush), Safari on iOS and
 * macOS (APNs, `*.push.apple.com`) and Edge (WNS). The server posts to the endpoint a client sends, so anything
 * else is refused: the database applies the same list (`push_subscriptions_endpoint_host`).
 */
const PUSH_HOSTS: readonly (string | RegExp)[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  /^([a-z0-9-]+\.)+push\.apple\.com$/,
  /^([a-z0-9-]+\.)+notify\.windows\.com$/,
];

/** Whether `endpoint` is an HTTPS URL on a known push service, without credentials or a custom port. */
export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return PUSH_HOSTS.some((host) =>
    typeof host === "string" ? url.hostname === host : host.test(url.hostname),
  );
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * Reads a subscription received from a client. Nothing is trusted: the shape, the endpoint host and the key
 * formats are checked here, and again by the database.
 * @returns The subscription, or `null` when it is not valid.
 */
export function parsePushSubscription(input: unknown): PushSubscriptionInput | null {
  if (typeof input !== "object" || input === null) return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: unknown };
  if (!isAllowedPushEndpoint(endpoint) || typeof keys !== "object" || keys === null) return null;

  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (typeof p256dh !== "string" || !BASE64URL.test(p256dh) || p256dh.length < 80) return null;
  if (p256dh.length > 100) return null;
  if (typeof auth !== "string" || !BASE64URL.test(auth) || auth.length < 16) return null;
  if (auth.length > 32) return null;
  return { endpoint, p256dh, auth };
}
