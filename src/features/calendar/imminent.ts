/** An event shows in the home banner from this many minutes before it starts, until it starts. */
export const IMMINENT_WINDOW_MINUTES = 30;

/** localStorage key of the event ids the user closed (per device). */
export const DISMISSED_STORAGE_KEY = "blocus.dismissed-events";
/** Only the most recent ids are kept so the list cannot grow forever. */
export const MAX_DISMISSED = 100;

/** Whole minutes left before `startsAtIso`, rounded up (0 once it has started). */
export function minutesUntil(startsAtIso: string, nowMs: number): number {
  const diff = new Date(startsAtIso).getTime() - nowMs;
  return diff <= 0 ? 0 : Math.ceil(diff / 60_000);
}

/** Whether the event has not started yet and starts within the banner window. */
export function isImminent(
  startsAtIso: string,
  nowMs: number,
  windowMinutes = IMMINENT_WINDOW_MINUTES,
): boolean {
  const diff = new Date(startsAtIso).getTime() - nowMs;
  return diff > 0 && diff <= windowMinutes * 60_000;
}

/** `dans 25 min`, or `dans moins d'une minute` during the last minute. */
export function countdownLabel(startsAtIso: string, nowMs: number): string {
  const diff = new Date(startsAtIso).getTime() - nowMs;
  return diff < 60_000 ? "dans moins d'une minute" : `dans ${minutesUntil(startsAtIso, nowMs)} min`;
}

/** Minimal storage interface (a subset of `Storage`), so the helpers are testable and fail-safe. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** Parses a stored dismissed list; anything unexpected yields an empty list. */
export function parseDismissed(raw: string | null | undefined): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Reads the dismissed event ids; any storage or parsing problem yields an empty list. */
export function readDismissed(storage: KeyValueStorage | null): string[] {
  try {
    return parseDismissed(storage?.getItem(DISMISSED_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Adds an id to the dismissed list (most recent last, capped) and returns the new list. */
export function addDismissed(storage: KeyValueStorage | null, id: string): string[] {
  const next = [...readDismissed(storage).filter((item) => item !== id), id].slice(-MAX_DISMISSED);
  try {
    storage?.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode): the banner is simply closed for this visit.
  }
  return next;
}
