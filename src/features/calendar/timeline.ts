import type { DayEvent } from "./calendar-types";

/** The hours a timeline shows, top to bottom. */
export type TimelineRange = { min: number; max: number };

/** Week columns are narrow and nobody plans before dawn: 6h to 24h (18 hours). */
export const WEEK_RANGE: TimelineRange = { min: 6, max: 24 };
/** The day view shows the whole day, from midnight to midnight (24 hours). */
export const DAY_RANGE: TimelineRange = { min: 0, max: 24 };

/** The day timeline scrolls, like the iOS Calendar: an hour is this tall. */
export const DAY_HOUR_PX = 56;
/** Height of the whole day timeline. */
export const DAY_HEIGHT_PX = (DAY_RANGE.max - DAY_RANGE.min) * DAY_HOUR_PX;
/** Shortest block of the day view: half an hour (28 px), enough for one line of text. */
export const DAY_MIN_HEIGHT_PERCENT = (0.5 / (DAY_RANGE.max - DAY_RANGE.min)) * 100;
/** Shortest block of the week view, in percent of its (fixed height) columns. */
export const WEEK_MIN_HEIGHT_PERCENT = 8;

const DEFAULT_START_HOUR = 7.5; // for an event that carries no hours at all (never the case for a real event)
/** An event without an end lasts this long on the timeline, as when one is created in the iOS Calendar. */
export const DEFAULT_DURATION_HOURS = 1;

/**
 * Where an event block starts and how tall it is, in percent of the timeline (`range`: the hours it shows).
 * An event without an end (`endHour` left out) gets {@link DEFAULT_DURATION_HOURS}; an end that does not come after the
 * start is treated the same way. A block is never shorter than `minHeightPercent`, so that it can be read and tapped.
 */
export function computeEventBounds(
  event: DayEvent,
  range: TimelineRange = WEEK_RANGE,
  minHeightPercent: number = WEEK_MIN_HEIGHT_PERCENT,
): {
  topPercent: number;
  heightPercent: number;
} {
  const span = range.max - range.min;
  const rawStart = event.startHour ?? DEFAULT_START_HOUR;
  const rawEnd =
    event.endHour != null && event.endHour > rawStart
      ? event.endHour
      : rawStart + DEFAULT_DURATION_HOURS;

  const start = Math.max(range.min, Math.min(range.max, rawStart));
  const end = Math.min(range.max, rawEnd);

  const topPercent = Math.max(
    0,
    Math.min(100 - minHeightPercent, ((start - range.min) / span) * 100),
  );
  const heightPercent = Math.max(
    minHeightPercent,
    Math.min(100 - topPercent, ((end - start) / span) * 100),
  );

  return { topPercent, heightPercent };
}

/** An event block placed on the timeline, side by side with the blocks it overlaps. */
export type PlacedEvent = {
  event: DayEvent;
  topPercent: number;
  heightPercent: number;
  /** Which of the `columns` columns of its group of overlapping blocks it sits in (0 = leftmost). */
  column: number;
  /** How many columns its group of overlapping blocks needs. 1 when it overlaps nothing. */
  columns: number;
};

/** Two blocks that merely touch (one ends where the next starts) do not overlap. */
const EPSILON = 1e-6;

/**
 * Places the events of one day on the timeline so that none covers another, the way the iOS and Google calendars do.
 *
 * Blocks that overlap, directly or through a chain of overlaps, form a group. In a group each block takes the first
 * column that is free at its start, and every block of the group gets the group's number of columns as its width
 * (`1 / columns` of the day). A block that overlaps nothing keeps the full width. Overlap is judged on the blocks as
 * drawn (with their minimum height), not on the real times: two events a few minutes apart would otherwise be drawn on
 * top of each other.
 */
export function layoutEvents(
  events: readonly DayEvent[],
  range: TimelineRange,
  minHeightPercent: number,
): PlacedEvent[] {
  const items = events
    .map((event) => {
      const bounds = computeEventBounds(event, range, minHeightPercent);
      return { event, ...bounds, end: bounds.topPercent + bounds.heightPercent };
    })
    .sort(
      (a, b) =>
        a.topPercent - b.topPercent || b.end - a.end || a.event.id.localeCompare(b.event.id),
    );

  const placed: PlacedEvent[] = [];
  let group: typeof items = [];
  let groupEnd = -Infinity;

  const flush = () => {
    const columnEnds: number[] = [];
    const columnOf = group.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.topPercent + EPSILON);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[column] = item.end;
      }
      return column;
    });
    group.forEach((item, index) =>
      placed.push({
        event: item.event,
        topPercent: item.topPercent,
        heightPercent: item.heightPercent,
        column: columnOf[index]!,
        columns: columnEnds.length,
      }),
    );
    group = [];
  };

  for (const item of items) {
    if (item.topPercent >= groupEnd - EPSILON) {
      flush();
      groupEnd = item.end;
    } else {
      groupEnd = Math.max(groupEnd, item.end);
    }
    group.push(item);
  }
  flush();
  return placed;
}

/** The hour labels of the day timeline: 00:00 to 23:00, one per hour (the day ends at the 00:00 that follows). */
export const DAY_HOURS = Array.from({ length: DAY_RANGE.max - DAY_RANGE.min }, (_, hour) => ({
  hour,
  label: `${String(hour).padStart(2, "0")}:00`,
}));

/** Vertical position, in pixels from the top of the day timeline, of an hour (`9.5` is 9:30). */
export const hourToPx = (hour: number) => (hour - DAY_RANGE.min) * DAY_HOUR_PX;

/** Height, in pixels, of a block of the day timeline. */
export const percentToDayPx = (percent: number) => (percent / 100) * DAY_HEIGHT_PX;

/**
 * One marker per exact start time among the events of the day, like the current-time line of the iOS Calendar: the
 * vertical position where the event block begins (`topPercent`), the hour it stands for and the time to print in the
 * left strip. Events that start together share one marker.
 */
export function startMarkersOf(
  events: readonly DayEvent[],
  range: TimelineRange = DAY_RANGE,
  minHeightPercent: number = DAY_MIN_HEIGHT_PERCENT,
): { startTime: string; topPercent: number; hour: number; eventId: string }[] {
  const markers = new Map<string, { topPercent: number; hour: number; eventId: string }>();
  for (const event of events) {
    if (!event.startTime || markers.has(event.startTime)) continue;
    markers.set(event.startTime, {
      topPercent: computeEventBounds(event, range, minHeightPercent).topPercent,
      hour: event.startHour ?? DEFAULT_START_HOUR,
      eventId: event.id,
    });
  }
  return [...markers]
    .map(([startTime, marker]) => ({ startTime, ...marker }))
    .sort((a, b) => a.topPercent - b.topPercent || a.startTime.localeCompare(b.startTime));
}

/** Labels closer than this (px) would print over each other. */
export const LABEL_CLEARANCE_PX = 14;

/**
 * The start markers of the day with their place in pixels, and whether each one writes its time: two starts a few
 * minutes apart both get their line, but only the first writes its time (the second would print over it).
 */
export function labelledMarkers(events: readonly DayEvent[]): {
  startTime: string;
  topPercent: number;
  hour: number;
  eventId: string;
  px: number;
  labelled: boolean;
}[] {
  const markers = [];
  let lastLabelPx = -Infinity;
  for (const marker of startMarkersOf(events)) {
    const px = percentToDayPx(marker.topPercent);
    const labelled = px - lastLabelPx >= LABEL_CLEARANCE_PX;
    if (labelled) lastLabelPx = px;
    markers.push({ ...marker, px, labelled });
  }
  return markers;
}

/** The first hour to show when the day timeline opens: an hour before the first event, or 7h on an empty day. */
export function initialScrollHour(events: readonly DayEvent[]): number {
  const first = events.reduce<number | null>(
    (earliest, event) =>
      event.startHour != null && (earliest === null || event.startHour < earliest)
        ? event.startHour
        : earliest,
    null,
  );
  return Math.max(0, (first ?? 8) - 1);
}
