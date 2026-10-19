import { cacheLife, cacheTag } from "next/cache";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** Totals per post, then per emoji: `{ [postId]: { "👍": 3 } }`. A plain object, so the data cache can store it. */
export type ReactionTotals = Record<string, Record<string, number>>;

/**
 * Reads the reaction totals of some public posts once for everybody (the view is readable by `anon`), cached and
 * shared for 2 min like the feed ("feed" profile). A reaction calls `updateTag("reactions")`, so the person who
 * reacted sees the new total at once; the others get it within 2 min, or at once with "Actualiser".
 * A failure is thrown, never returned: an error must not be cached.
 */
async function fetchReactionTotals(postIds: string[]): Promise<ReactionTotals> {
  "use cache";
  cacheLife("feed");
  cacheTag("reactions");

  if (postIds.length === 0) return {};
  const { data, error } = await createPublicClient()
    .from("announcement_reaction_counts")
    .select("announcement_id, emoji, total")
    .in("announcement_id", postIds);
  if (error) throw new Error(error.message);

  const totals: ReactionTotals = {};
  for (const row of data) {
    // The view types every column as nullable; none is for a real row.
    if (!row.announcement_id || !row.emoji || !row.total) continue;
    (totals[row.announcement_id] ??= {})[row.emoji] = row.total;
  }
  return totals;
}

/**
 * Lists the reaction totals of the given public posts. Readable by Guests and shared through the data cache.
 * @param postIds - Ids of the posts shown on the page.
 */
export async function listReactionTotals(
  postIds: string[],
): Promise<Result<ReactionTotals, "load_failed">> {
  try {
    return ok(await fetchReactionTotals(postIds));
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/**
 * Lists the emojis the signed-in user already used, per post. Not cached: it depends on who asks (Row Level
 * Security only returns the caller's own rows, the `user_id` filter makes that explicit).
 * @param userId - The caller's id.
 * @param postIds - Ids of the posts shown on the page.
 */
export async function listMyReactions(
  userId: string,
  postIds: string[],
): Promise<Result<Record<string, string[]>, "load_failed">> {
  if (postIds.length === 0) return ok({});
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("announcement_reactions")
      .select("announcement_id, emoji")
      .eq("user_id", userId)
      .in("announcement_id", postIds);
    if (error) return err("load_failed", error.message);

    const mine: Record<string, string[]> = {};
    for (const row of data) (mine[row.announcement_id] ??= []).push(row.emoji);
    return ok(mine);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
