/** Seen within this long ago counts as online: twice the 5-minute interval at which browsers report. */
export const ONLINE_WINDOW_MS = 10 * 60_000;

/** What to show for a user's last activity. */
export type LastSeenStatus =
  { state: "online" } | { state: "offline"; agoLabel: string } | { state: "unknown" };

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "always" });

/** `il y a 3 heures`, from a duration in milliseconds. The unit is the largest that fits at least once. */
export function agoLabel(elapsedMs: number): string {
  const minutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return relative.format(-days, "day");
  if (days < 365) return relative.format(-Math.floor(days / 30), "month");
  return relative.format(-Math.floor(days / 365), "year");
}

/**
 * Online, offline (with how long ago) or unknown, from the date `get_last_seen()` returned.
 * @param lastSeen - ISO date, or `null` when the user was never seen.
 */
export function lastSeenStatus(lastSeen: string | null, now: Date = new Date()): LastSeenStatus {
  if (!lastSeen) return { state: "unknown" };
  const time = Date.parse(lastSeen);
  if (!Number.isFinite(time)) return { state: "unknown" };
  // A date slightly in the future (clock skew) still means "just now".
  const elapsed = Math.max(0, now.getTime() - time);
  return elapsed < ONLINE_WINDOW_MS
    ? { state: "online" }
    : { state: "offline", agoLabel: agoLabel(elapsed) };
}
