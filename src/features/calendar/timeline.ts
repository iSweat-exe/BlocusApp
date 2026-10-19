import type { DayEvent } from "./calendar-types";

/** The hours a timeline shows, top to bottom. */
export type TimelineRange = { min: number; max: number };

/** Week columns are narrow and nobody plans before dawn: 6h to 24h (18 hours). */
export const WEEK_RANGE: TimelineRange = { min: 6, max: 24 };
/** The day view shows the whole day, from midnight to midnight (24 hours). */
export const DAY_RANGE: TimelineRange = { min: 0, max: 24 };

const DEFAULT_START_HOUR = 7.5; // 7h30 par défaut si non renseigné
const DEFAULT_END_HOUR = 18; // 18h00 par défaut si non renseigné

/** Where an event block starts and how tall it is, in percent of the timeline (`range`: the hours it shows). */
export function computeEventBounds(
  event: DayEvent,
  range: TimelineRange = WEEK_RANGE,
): {
  topPercent: number;
  heightPercent: number;
} {
  const span = range.max - range.min;
  const hasExplicitStart = event.startHour != null;
  const rawStart = hasExplicitStart ? event.startHour! : DEFAULT_START_HOUR;

  const hasExplicitEnd = event.endHour != null;
  let rawEnd: number;
  if (hasExplicitEnd) {
    rawEnd = event.endHour!;
  } else if (hasExplicitStart) {
    rawEnd = rawStart < DEFAULT_END_HOUR ? DEFAULT_END_HOUR : Math.min(range.max, rawStart + 1);
  } else {
    rawEnd = DEFAULT_END_HOUR;
  }

  const start = Math.max(range.min, Math.min(range.max, rawStart));
  const end = Math.max(start + 0.5, Math.min(range.max, rawEnd));

  const topPercent = Math.max(0, Math.min(92, ((start - range.min) / span) * 100));
  const heightPercent = Math.max(8, Math.min(100 - topPercent, ((end - start) / span) * 100));

  return { topPercent, heightPercent };
}

/**
 * The hours written on the left of the day timeline: every six hours, midnight at both ends (the bottom one is the
 * midnight that ends the day, so the timeline reads 00:00 to 00:00).
 */
export const DAY_HOUR_MARKS = [0, 6, 12, 18, 24].map((hour) => ({
  hour,
  label: `${String(hour % 24).padStart(2, "0")}:00`,
  percent: ((hour - DAY_RANGE.min) / (DAY_RANGE.max - DAY_RANGE.min)) * 100,
}));

/**
 * One marker per exact start time among the events of the day, like the current-time line of the iOS Calendar: the
 * vertical position where the event block begins (`topPercent`), the hour it stands for (to hide the grey hour
 * label it would overlap) and the time to print in the left strip. Events that start together share one marker.
 */
export function startMarkersOf(
  events: readonly DayEvent[],
  range: TimelineRange = DAY_RANGE,
): { startTime: string; topPercent: number; hour: number }[] {
  const markers = new Map<string, { topPercent: number; hour: number }>();
  for (const event of events) {
    if (!event.startTime || markers.has(event.startTime)) continue;
    markers.set(event.startTime, {
      topPercent: computeEventBounds(event, range).topPercent,
      hour: event.startHour ?? DEFAULT_START_HOUR,
    });
  }
  return [...markers]
    .map(([startTime, marker]) => ({ startTime, ...marker }))
    .sort((a, b) => a.topPercent - b.topPercent || a.startTime.localeCompare(b.startTime));
}
