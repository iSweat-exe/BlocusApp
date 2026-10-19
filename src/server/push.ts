import webpush, { type WebPushError } from "web-push";
import { buildPushPayload, type PushMessage } from "@/features/push/payload";
import { createServiceClient } from "@/lib/supabase/service";
import { getSiteUrl } from "@/lib/site";

/** Notifications sent at the same time: enough to finish fast, few enough to stay polite with push services. */
const CONCURRENCY = 20;
/** Keep the message for a day for a device that is offline; a news post is stale after that. */
const TTL_SECONDS = 24 * 60 * 60;
/** Give up on a push service that does not answer (the function has a limited duration). */
const SEND_TIMEOUT_MS = 8000;

/** Result of one broadcast, for logs and tests. */
export type BroadcastResult = { sent: number; removed: number; failed: number };

/**
 * Whether the VAPID keys are configured. Without them push is simply off (previews, local development, CI).
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public by design; `VAPID_PRIVATE_KEY` is server only, never prefix it.
 */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Whether a push service answer means the subscription is gone for good (to delete, never to retry). */
function isGone(error: unknown): boolean {
  const status = (error as Partial<WebPushError> | null)?.statusCode;
  return status === 404 || status === 410;
}

/**
 * Sends a notification to every subscribed device. Meant to run after the response (`after()`), so it never
 * throws: a push problem must not fail the action that triggered it. Subscriptions that the push service reports as
 * gone (404 / 410) are deleted. No endpoint, key or title is logged.
 * @param message - What to show; `url` must be on this site.
 */
export async function broadcastPush(message: Omit<PushMessage, "url"> & { path: string }) {
  const result: BroadcastResult = { sent: 0, removed: 0, failed: 0 };
  if (!isPushConfigured()) return result;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    const payload = buildPushPayload({ ...message, url: `${getSiteUrl()}${message.path}` });
    const client = createServiceClient();

    const { data, error } = await client
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    if (error) throw new Error(error.message);

    const gone: string[] = [];
    for (let i = 0; i < data.length; i += CONCURRENCY) {
      await Promise.all(
        data.slice(i, i + CONCURRENCY).map(async (row) => {
          try {
            await webpush.sendNotification(
              { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
              payload,
              { TTL: TTL_SECONDS, urgency: "normal", timeout: SEND_TIMEOUT_MS },
            );
            result.sent += 1;
          } catch (cause) {
            if (isGone(cause)) gone.push(row.endpoint);
            else result.failed += 1;
          }
        }),
      );
    }

    if (gone.length > 0) {
      const { error: deleteError } = await client
        .from("push_subscriptions")
        .delete()
        .in("endpoint", gone);
      if (deleteError) console.error("[broadcastPush] could not remove expired subscriptions");
      else result.removed = gone.length;
    }
  } catch (cause) {
    console.error(
      "[broadcastPush] failed:",
      cause instanceof Error ? cause.message : "unknown error",
    );
  }

  console.warn(
    `[broadcastPush] sent=${result.sent} removed=${result.removed} failed=${result.failed}`,
  );
  return result;
}
