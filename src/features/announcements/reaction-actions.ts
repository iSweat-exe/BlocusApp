"use server";

import { updateTag } from "next/cache";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { isRateLimited, RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import { isReactionEmoji } from "./reactions";

/** Outcome of a tap on a reaction. */
export type ReactionResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Adds the caller's reaction to a public post, or removes it when they already used that emoji. Any signed-in
 * user who is not banned can react; the database enforces it (and the rate limit) in `toggle_announcement_reaction`.
 */
export async function toggleReaction(
  announcementId: string,
  emoji: string,
): Promise<ReactionResult> {
  if (!UUID.test(announcementId) || !isReactionEmoji(emoji)) {
    return { ok: false, message: "Demande invalide." };
  }

  const supabase = createClient(await requestCookies());
  const { error } = await supabase.rpc("toggle_announcement_reaction", {
    p_announcement_id: announcementId,
    p_emoji: emoji,
  });
  if (error) {
    if (isRateLimited(error)) return { ok: false, message: RATE_LIMITED_MESSAGE };
    if (error.code === "42501") {
      return { ok: false, message: "Connecte-toi avec un compte actif pour réagir." };
    }
    if (error.code === "22023") return { ok: false, message: "Ce post n'existe plus." };
    logActionError("toggleReaction", error);
    return { ok: false, message: "La réaction a échoué. Réessaie." };
  }

  updateTag("reactions");
  return { ok: true };
}
