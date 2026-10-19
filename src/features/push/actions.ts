"use server";

import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { isRateLimited, RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import {
  explainInvalidSubscription,
  isAllowedPushEndpoint,
  parsePushSubscription,
} from "./subscription";

/** Outcome of saving or removing a subscription. */
export type PushResult = { ok: true } | { ok: false; message: string };

const SIGN_IN_MESSAGE = "Connecte-toi avec un compte actif pour activer les notifications.";

/** Turns a database error into what the user is told; unexpected ones are logged. */
function refusal(action: string, error: { code?: string; message: string }): PushResult {
  if (isRateLimited(error)) return { ok: false, message: RATE_LIMITED_MESSAGE };
  if (error.code === "42501") return { ok: false, message: SIGN_IN_MESSAGE };
  logActionError(action, error);
  return { ok: false, message: "L'opération a échoué. Réessaie." };
}

/**
 * Saves the push subscription of the current device for the signed-in user (idempotent: the page calls it again
 * on every visit to the settings to keep the server in sync). `input` is `PushSubscription.toJSON()`.
 */
export async function savePushSubscription(input: unknown): Promise<PushResult> {
  const subscription = parsePushSubscription(input);
  if (!subscription) {
    const reason = explainInvalidSubscription(input);
    // The reason names the push service host at most (no path, no key): the one clue to an unsupported browser.
    console.warn("[savePushSubscription] refused:", reason);
    return { ok: false, message: `Abonnement invalide : ${reason}.` };
  }

  const supabase = createClient(await requestCookies());
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
  });
  return error ? refusal("savePushSubscription", error) : { ok: true };
}

/** Removes the subscription of the current device (the user turned notifications off). */
export async function removePushSubscription(endpoint: unknown): Promise<PushResult> {
  if (!isAllowedPushEndpoint(endpoint)) return { ok: false, message: "Abonnement invalide." };

  const supabase = createClient(await requestCookies());
  const { error } = await supabase.rpc("remove_push_subscription", { p_endpoint: endpoint });
  return error ? refusal("removePushSubscription", error) : { ok: true };
}
