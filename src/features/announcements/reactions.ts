/**
 * The palette of emoji reactions, in display order. A fixed list (not any emoji, unlike Discord) keeps the data
 * small, the picker one row long, and the database check simple. Kept in sync with the `check` of
 * `announcement_reactions.emoji` (migration `20261019100000_post_reactions.sql`): a change needs a new migration.
 */
export const REACTION_EMOJIS = ["👍", "💜", "😂", "😮", "😢", "🔥", "🎉", "👏"] as const;

/** One emoji of the palette. */
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Accessible names, read by screen readers instead of the emoji itself. */
export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  "👍": "pouce levé",
  "💜": "cœur violet",
  "😂": "rire",
  "😮": "surprise",
  "😢": "tristesse",
  "🔥": "feu",
  "🎉": "fête",
  "👏": "applaudissements",
};

/** Whether a value received from a client is one of the palette's emojis. */
export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === "string" && (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** What a post shows: how many people used each emoji, and which ones the viewer used. */
export type ReactionState = {
  counts: Partial<Record<ReactionEmoji, number>>;
  mine: ReactionEmoji[];
};

/**
 * Builds the state of one post from the shared totals and the viewer's own reactions. The totals are cached for
 * a few minutes, so they may not include the viewer's latest tap yet: the viewer's own reactions always count
 * for at least one, so the number never contradicts the highlighted emoji.
 */
export function buildReactionState(
  totals: Partial<Record<string, number>> | undefined,
  mine: readonly string[],
): ReactionState {
  const counts: ReactionState["counts"] = {};
  const own: ReactionEmoji[] = [];
  for (const emoji of REACTION_EMOJIS) {
    const isMine = mine.includes(emoji);
    const total = Math.max(totals?.[emoji] ?? 0, isMine ? 1 : 0);
    if (total > 0) counts[emoji] = total;
    if (isMine) own.push(emoji);
  }
  return { counts, mine: own };
}

/** The state after the viewer taps `emoji`: adds their reaction, or removes it when they already used it. */
export function toggleReactionState(state: ReactionState, emoji: ReactionEmoji): ReactionState {
  const wasMine = state.mine.includes(emoji);
  const next = Math.max(0, (state.counts[emoji] ?? 0) + (wasMine ? -1 : 1));
  const counts = { ...state.counts };
  if (next > 0) counts[emoji] = next;
  else delete counts[emoji];
  return {
    counts,
    mine: wasMine ? state.mine.filter((item) => item !== emoji) : [...state.mine, emoji],
  };
}
