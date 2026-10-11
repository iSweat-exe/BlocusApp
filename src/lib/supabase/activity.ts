/**
 * Cookie that remembers the hour and the user (see {@link activityMark}) for which this browser's activity was last
 * reported. It only throttles: the database counts a user once per hour whatever the cookie says
 * (`touch_activity()`).
 */
export const ACTIVITY_COOKIE_NAME = "blocus-seen";

const HOUR_MS = 3_600_000;

/** Identifier of the current UTC hour: whole hours since 1970, as text. */
export function activityStamp(now: number = Date.now()): string {
  return String(Math.floor(now / HOUR_MS));
}

/**
 * What the cookie holds: the current UTC hour and the user it was reported for. Tying it to the user means a second
 * account signing in on the same browser within the hour is still counted.
 */
export function activityMark(userId: string, now: number = Date.now()): string {
  return `${activityStamp(now)}:${userId}`;
}

/** Options of the cookie: not readable by scripts, gone after an hour, which is also what it throttles. */
export const activityCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 3600,
} as const;
