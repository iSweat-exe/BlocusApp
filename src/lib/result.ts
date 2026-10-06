/** Successful outcome carrying a value. */
export type Ok<T> = { ok: true; value: T };

/** Failed outcome carrying a machine-readable error code and an optional message. */
export type Err<E extends string = string> = { ok: false; error: E; message?: string };

/** Explicit result type for expected failures (no exceptions in the normal control flow). */
export type Result<T, E extends string = string> = Ok<T> | Err<E>;

/**
 * Builds a successful result.
 * @param value - The value to return to the caller.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Builds a failed result.
 * @param error - Stable error code (safe to branch on, never contains personal data).
 * @param message - Optional human-readable detail, for logs only.
 */
export function err<E extends string>(error: E, message?: string): Err<E> {
  return message === undefined ? { ok: false, error } : { ok: false, error, message };
}
