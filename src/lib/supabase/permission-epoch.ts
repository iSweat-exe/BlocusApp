/**
 * Whether a session token was issued before the permissions last changed, so that its role and permission
 * claims may be out of date and the token must be re-issued.
 * @param issuedAt - The token's `iat` claim, in seconds since the epoch.
 * @param epochIso - `get_permission_epoch()`: when roles, permissions, overrides or sanctions last changed.
 * @returns `false` when either value is missing or unreadable: never refresh on doubt.
 */
export function isTokenStale(issuedAt: unknown, epochIso: string | null | undefined): boolean {
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt) || !epochIso) return false;
  const epoch = Date.parse(epochIso);
  return Number.isFinite(epoch) && issuedAt * 1000 < epoch;
}

/** How long a server instance keeps the epoch it read before asking the database again. */
export const EPOCH_TTL_MS = 10_000;

type Memo = { value: string | null; readAt: number };

/**
 * Small per-instance memo around the epoch read: at most one database read per `EPOCH_TTL_MS` per warm
 * server instance, however many requests it serves.
 */
export function createEpochReader(
  read: () => Promise<string | null>,
  now: () => number = Date.now,
): () => Promise<string | null> {
  let memo: Memo | null = null;
  let inFlight: Promise<string | null> | null = null;

  return async () => {
    if (memo && now() - memo.readAt < EPOCH_TTL_MS) return memo.value;
    // Concurrent requests share one read.
    inFlight ??= read()
      .catch(() => memo?.value ?? null) // a database hiccup must never break a page
      .then((value) => {
        memo = { value, readAt: now() };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
