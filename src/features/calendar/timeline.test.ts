import { describe, expect, it } from "vitest";
import type { DayEvent } from "./calendar-types";
import {
  computeEventBounds,
  DAY_HEIGHT_PX,
  DAY_HOUR_PX,
  DAY_MIN_HEIGHT_PERCENT,
  DAY_RANGE,
  DEFAULT_DURATION_HOURS,
  hourToPx,
  initialScrollHour,
  labelledMarkers,
  layoutEvents,
  startMarkersOf,
  WEEK_MIN_HEIGHT_PERCENT,
  WEEK_RANGE,
} from "./timeline";

const event = (id: string, startHour: number, endHour?: number, startTime?: string): DayEvent => ({
  id,
  title: `Événement ${id}`,
  location: "",
  time: "",
  finished: false,
  startHour,
  ...(endHour === undefined ? {} : { endHour }),
  ...(startTime === undefined ? {} : { startTime }),
});

const layout = (events: DayEvent[]) =>
  layoutEvents(events, DAY_RANGE, DAY_MIN_HEIGHT_PERCENT).map((item) => ({
    id: item.event.id,
    column: item.column,
    columns: item.columns,
  }));

describe("computeEventBounds", () => {
  it("places a block by its hours, in percent of the hours the timeline shows", () => {
    // 9h to 12h on a day of 24 h: 9/24 down, 3/24 tall.
    const day = computeEventBounds(event("a", 9, 12), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    expect(day.topPercent).toBeCloseTo(37.5, 2);
    expect(day.heightPercent).toBeCloseTo(12.5, 2);
    // The week shows 6h to 24h: 10h to 11h is 4/18 down, 1/18 tall.
    const week = computeEventBounds(event("b", 10, 11));
    expect(week.topPercent).toBeCloseTo(22.22, 1);
    expect(week.heightPercent).toBeCloseTo(8, 1);
  });

  it("gives an event without an end the default length, never a block up to 18h", () => {
    const withEnd = computeEventBounds(event("a", 14, 15), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    const withoutEnd = computeEventBounds(event("b", 14), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    expect(DEFAULT_DURATION_HOURS).toBe(1);
    expect(withoutEnd).toEqual(withEnd);
  });

  it("treats an end that is not after the start like no end", () => {
    const base = computeEventBounds(event("a", 14), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    expect(computeEventBounds(event("b", 14, 14), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT)).toEqual(base);
    expect(computeEventBounds(event("c", 14, 9), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT)).toEqual(base);
  });

  it("never draws a block shorter than the minimum, so that it can be read and tapped", () => {
    const short = computeEventBounds(event("a", 10, 10.1), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    expect(short.heightPercent).toBeCloseTo(DAY_MIN_HEIGHT_PERCENT, 5);
    // Half an hour on the day timeline is 28 px.
    expect((DAY_MIN_HEIGHT_PERCENT / 100) * DAY_HEIGHT_PX).toBeCloseTo(DAY_HOUR_PX / 2, 5);
    expect(computeEventBounds(event("b", 10, 10.1)).heightPercent).toBe(WEEK_MIN_HEIGHT_PERCENT);
  });

  it("keeps a late event on the timeline and cuts a long one at the end of the day", () => {
    const late = computeEventBounds(event("a", 23.75), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    expect(late.topPercent + late.heightPercent).toBeCloseTo(100, 5);
    const running = computeEventBounds(event("b", 22, 24), DAY_RANGE, DAY_MIN_HEIGHT_PERCENT);
    expect(running.topPercent + running.heightPercent).toBeCloseTo(100, 5);
  });

  it("clamps what the week does not show to its first and last hour", () => {
    expect(computeEventBounds(event("a", 3, 4)).topPercent).toBe(0);
    const night = computeEventBounds(event("b", 5, 8));
    expect(night.topPercent).toBe(0);
    expect(night.heightPercent).toBeCloseTo((2 / 18) * 100, 2);
  });

  it("falls back to 7h30 for an event that carries no hours at all", () => {
    const bounds = computeEventBounds({
      id: "x",
      title: "t",
      location: "",
      time: "",
      finished: false,
    });
    expect(bounds.topPercent).toBeCloseTo(((7.5 - WEEK_RANGE.min) / 18) * 100, 2);
  });
});

describe("layoutEvents", () => {
  it("gives an event that overlaps nothing the whole width", () => {
    expect(layout([event("a", 9, 10), event("b", 14, 15)])).toEqual([
      { id: "a", column: 0, columns: 1 },
      { id: "b", column: 0, columns: 1 },
    ]);
  });

  it("does not count two events that merely touch as overlapping", () => {
    expect(layout([event("a", 9, 10), event("b", 10, 11)])).toEqual([
      { id: "a", column: 0, columns: 1 },
      { id: "b", column: 0, columns: 1 },
    ]);
  });

  it("puts two overlapping events side by side, each on half the width", () => {
    expect(layout([event("a", 9, 11), event("b", 10, 12)])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
    ]);
  });

  it("reuses a free column inside a group, and gives the whole group the same width", () => {
    // a runs 9-13; b 10-11 beside it; c 11-12 takes b's column again.
    expect(layout([event("a", 9, 13), event("b", 10, 11), event("c", 11, 12)])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
      { id: "c", column: 1, columns: 2 },
    ]);
  });

  it("spreads three events that all overlap over three columns", () => {
    expect(layout([event("a", 9, 12), event("b", 9.5, 12), event("c", 10, 12)])).toEqual([
      { id: "a", column: 0, columns: 3 },
      { id: "b", column: 1, columns: 3 },
      { id: "c", column: 2, columns: 3 },
    ]);
  });

  it("links events through a chain: a overlaps b, b overlaps c, a and c do not", () => {
    expect(layout([event("a", 9, 10.5), event("b", 10, 12), event("c", 11.5, 13)])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
      { id: "c", column: 0, columns: 2 },
    ]);
  });

  it("keeps separate groups at their own width", () => {
    const result = layout([event("a", 9, 11), event("b", 10, 12), event("c", 15, 16)]);
    expect(result.find((item) => item.id === "c")).toEqual({ id: "c", column: 0, columns: 1 });
    expect(result.filter((item) => item.columns === 2)).toHaveLength(2);
  });

  it("judges overlap on the blocks as drawn: two starts 10 minutes apart cannot share a place", () => {
    // 9:00 and 9:10, 15 minutes each: the real times do not overlap, but each block is drawn 30 minutes tall.
    expect(layout([event("a", 9, 9.25), event("b", 9 + 10 / 60, 9 + 25 / 60)])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
    ]);
  });

  it("puts events with no end side by side when they start within their default hour", () => {
    expect(layout([event("a", 14), event("b", 14.5)])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
    ]);
  });

  it("returns every event once, whatever the order it was given", () => {
    const events = [event("c", 11, 12), event("a", 9, 10.5), event("b", 10, 11.5)];
    expect(
      layout(events)
        .map((item) => item.id)
        .sort(),
    ).toEqual(["a", "b", "c"]);
    expect(layout([])).toEqual([]);
  });
});

describe("start markers", () => {
  it("gives one marker per exact start time, from the top of the timeline down", () => {
    const markers = startMarkersOf([
      event("a", 14.5, 15, "14:30"),
      event("b", 9.25, 10, "09:15"),
      event("c", 14.5, 16, "14:30"),
    ]);
    expect(markers.map((marker) => marker.startTime)).toEqual(["09:15", "14:30"]);
    expect(markers[0]!.topPercent).toBeCloseTo((9.25 / 24) * 100, 2);
    expect(markers[0]!.eventId).toBe("b");
    // The first event of a shared start gives its colour to the marker.
    expect(markers[1]!.eventId).toBe("a");
  });

  it("has none for an event without an exact start time", () => {
    expect(startMarkersOf([event("a", 9, 10)])).toEqual([]);
  });

  it("writes only the first time of two starts that would print over each other", () => {
    const markers = labelledMarkers([
      event("a", 9, 10, "09:00"),
      event("b", 9.1, 10, "09:06"),
      event("c", 12, 13, "12:00"),
    ]);
    expect(markers.map((marker) => [marker.startTime, marker.labelled])).toEqual([
      ["09:00", true],
      ["09:06", false],
      ["12:00", true],
    ]);
    expect(markers[2]!.px).toBeCloseTo(hourToPx(12), 5);
  });
});

describe("initialScrollHour", () => {
  it("opens an hour before the first event", () => {
    expect(initialScrollHour([event("a", 14), event("b", 9.5, 10)])).toBe(8.5);
  });

  it("opens on the morning of an empty day, and never above midnight", () => {
    expect(initialScrollHour([])).toBe(7);
    expect(initialScrollHour([event("a", 0.5)])).toBe(0);
  });
});
