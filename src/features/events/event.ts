/**
 * Seasonal looks of the whole application ("events"). An event is switched on by the date of the device (so the
 * server and the cache know nothing about it), or by a preview stored on the device for testing.
 */
export type EventKey = "halloween";

/**
 * Local storage key of the preview: `halloween` forces the event on any day, `off` switches it off even on its
 * day, nothing follows the calendar. Set it with `?event=halloween`, `?event=off` or clear it with `?event=reset`.
 */
export const EVENT_STORAGE_KEY = "blocus.event";

/** Browser bar color of each event, kept equal to its night color in `halloween.css` (a test checks it). */
export const EVENT_COLORS: Record<EventKey, string> = { halloween: "#120a1f" };

/** The event running on a day (local time of the device), if any. Halloween: 31 October. */
export function eventOfDate(date: Date): EventKey | null {
  return date.getMonth() === 9 && date.getDate() === 31 ? "halloween" : null;
}

/**
 * The event to show.
 * @param date - Now, on the device.
 * @param preview - Value stored under `EVENT_STORAGE_KEY`.
 */
export function resolveEvent(date: Date, preview: string | null): EventKey | null {
  if (preview === "halloween") return "halloween";
  if (preview === "off") return null;
  return eventOfDate(date);
}
