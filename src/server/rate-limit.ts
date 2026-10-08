/**
 * What the user is told when the database refuses an action because they made too many in a short time
 * (`rate_limited`, raised by `consume_rate_limit()`, see `docs/security.md`).
 */
export const RATE_LIMITED_MESSAGE =
  "Trop d'actions en peu de temps. Patiente un moment avant de réessayer.";

/**
 * Tells whether a database error is a rate limit refusal. The limit itself lives in the database (a client can
 * call PostgREST without going through a Server Action); this only lets an action show a clear message instead of
 * a generic failure, and skip the "unexpected error" log.
 */
export function isRateLimited(error: { message: string }): boolean {
  return error.message === "rate_limited";
}
