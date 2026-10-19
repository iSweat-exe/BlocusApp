import type { DayEvent } from "./calendar-types";
import { dayKeyOf, formatTime, formatTimeRange, timeToHour } from "./time";

/** What the calendar reads of an event row (`listEventsBetween`). */
export type EventRow = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  finished_at: string | null;
};

/**
 * Turns an event row into what the client draws, with the hours the timeline needs.
 *
 * The end of an event is optional, and the timeline never invents one: without an end (or with an end that does not
 * come after the start, which the form refuses but old rows may hold) `endHour` is left out, and the timeline draws a
 * block of the default length with the start time alone. An end on a later day (an event that runs past midnight)
 * is cut at 24h, where the day stops. The start is never moved: an event at 5h30 starts at 5.5, and the week view,
 * which only shows 6h to 24h, clamps it itself.
 */
export function toDayEvent(event: EventRow): DayEvent {
  const startHour = timeToHour(event.starts_at);
  const hasEnd = event.ends_at !== null && new Date(event.ends_at) > new Date(event.starts_at);
  const sameDay =
    hasEnd && dayKeyOf(new Date(event.ends_at!)) === dayKeyOf(new Date(event.starts_at));

  return {
    id: event.id,
    title: event.title,
    location: event.location ?? "",
    time: formatTimeRange(event.starts_at, hasEnd ? event.ends_at : null),
    finished: event.finished_at !== null,
    startHour,
    ...(hasEnd ? { endHour: sameDay ? timeToHour(event.ends_at!) : 24 } : {}),
    startTime: formatTime(event.starts_at),
  };
}
