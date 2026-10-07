/** Announcements shown at first, and added by each "Voir plus". */
export const FEED_STEP = 10;
/** The feed never shows more than this (older posts are not browsable yet): bounds the payload per visit. */
export const FEED_MAX = 50;

/**
 * Reads the `n` query parameter of the home page: how many announcements to show. Anything invalid falls back to
 * the first page; valid values are rounded up to a multiple of the step, so only a handful of distinct values
 * (10, 20, ... 50) can ever exist, which keeps the shared cache small.
 */
export function parseFeedLimit(raw: unknown): number {
  const requested = typeof raw === "string" && /^\d{1,3}$/.test(raw) ? Number(raw) : FEED_STEP;
  return Math.min(FEED_MAX, Math.max(FEED_STEP, Math.ceil(requested / FEED_STEP) * FEED_STEP));
}
