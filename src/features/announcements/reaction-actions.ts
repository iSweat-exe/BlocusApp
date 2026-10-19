"use server";

import { updateTag } from "next/cache";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { isRateLimited, RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import { groupReactors, isReactionEmoji, isReactionKind, type ReactorsByEmoji } from "./reactions";

/** Outcome of a tap on a reaction. */
export type ReactionResult = { ok: true } | { ok: false; message: string };

/** Outcome of asking who reacted. */
export type ReactorsResult =
  { ok: true; reactors: ReactorsByEmoji } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGN_IN_MESSAGE = "Connecte-toi avec un compte actif pour réagir.";

/**
 * Adds the caller's reaction to a public post or to an event, or removes it when they already used that emoji.
 * Any signed-in user who is not banned can react; the database enforces it (and the rate limit) in
 * `toggle_announcement_reaction` / `toggle_event_reaction`.
 */
export async function toggleReaction(
  kind: string,
  targetId: string,
  emoji: string,
): Promise<ReactionResult> {
  if (!isReactionKind(kind) || !UUID.test(targetId) || !isReactionEmoji(emoji)) {
    return { ok: false, message: "Demande invalide." };
  }

  const supabase = createClient(await requestCookies());
  const { error } =
    kind === "post"
      ? await supabase.rpc("toggle_announcement_reaction", {
          p_announcement_id: targetId,
          p_emoji: emoji,
        })
      : await supabase.rpc("toggle_event_reaction", { p_event_id: targetId, p_emoji: emoji });
  if (error) {
    if (isRateLimited(error)) return { ok: false, message: RATE_LIMITED_MESSAGE };
    if (error.code === "42501") return { ok: false, message: SIGN_IN_MESSAGE };
    if (error.code === "22023") {
      return {
        ok: false,
        message: kind === "post" ? "Ce post n'existe plus." : "Cet événement n'existe plus.",
      };
    }
    logActionError("toggleReaction", error);
    return { ok: false, message: "La réaction a échoué. Réessaie." };
  }

  updateTag("reactions");
  return { ok: true };
}

/**
 * Lists who reacted to a public post or to an event, by emoji. Signed-in people only (the database refuses a
 * Guest with `42501`): Guests see the totals, never the pseudos. Not cached, it is read when asked.
 */
export async function listReactors(kind: string, targetId: string): Promise<ReactorsResult> {
  if (!isReactionKind(kind) || !UUID.test(targetId)) {
    return { ok: false, message: "Demande invalide." };
  }

  const supabase = createClient(await requestCookies());
  const { data, error } =
    kind === "post"
      ? await supabase.rpc("list_announcement_reactors", { p_announcement_id: targetId })
      : await supabase.rpc("list_event_reactors", { p_event_id: targetId });
  if (error) {
    if (error.code === "42501") {
      return { ok: false, message: "Connecte-toi avec un compte pour voir qui a réagi." };
    }
    logActionError("listReactors", error);
    return { ok: false, message: "Impossible de charger la liste. Réessaie." };
  }
  return { ok: true, reactors: groupReactors(data) };
}
