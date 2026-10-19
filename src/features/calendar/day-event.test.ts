import { describe, expect, it } from "vitest";
import { toDayEvent, type EventRow } from "./day-event";

// 20 October 2026: Paris is on summer time (UTC+2).
const row = (overrides: Partial<EventRow> = {}): EventRow => ({
  id: "e1",
  title: "Départ du cortège",
  location: "Place de la République",
  starts_at: "2026-10-20T12:00:00Z",
  ends_at: "2026-10-20T14:30:00Z",
  finished_at: null,
  ...overrides,
});

describe("toDayEvent", () => {
  it("gives the hours of the timeline in the time zone of the event, and the exact start", () => {
    expect(toDayEvent(row())).toEqual({
      id: "e1",
      title: "Départ du cortège",
      location: "Place de la République",
      time: "14:00 – 16:30",
      finished: false,
      startHour: 14,
      endHour: 16.5,
      startTime: "14:00",
    });
  });

  it("leaves the end out when there is none: no invented end, the start time alone", () => {
    const event = toDayEvent(row({ ends_at: null }));
    expect(event.time).toBe("14:00");
    expect(event).not.toHaveProperty("endHour");
    expect(event.startHour).toBe(14);
  });

  it.each([
    ["equal to the start", "2026-10-20T12:00:00Z"],
    ["before the start", "2026-10-20T10:00:00Z"],
    ["on an earlier day", "2026-10-19T14:00:00Z"],
  ])("treats an end %s like no end", (_name, endsAt) => {
    const event = toDayEvent(row({ ends_at: endsAt }));
    expect(event).not.toHaveProperty("endHour");
    expect(event.time).toBe("14:00");
  });

  it("cuts an event that runs past midnight at the end of the day, and keeps its real end in the text", () => {
    // 22:00 to 02:00 the next day, in Paris.
    const event = toDayEvent(
      row({ starts_at: "2026-10-20T20:00:00Z", ends_at: "2026-10-21T00:00:00Z" }),
    );
    expect(event.startHour).toBe(22);
    expect(event.endHour).toBe(24);
    expect(event.time).toBe("22:00 – 02:00");
  });

  it("never moves the start: an event at 5h30 starts at 5.5", () => {
    const event = toDayEvent(row({ starts_at: "2026-10-20T03:30:00Z", ends_at: null }));
    expect(event.startHour).toBe(5.5);
    expect(event.startTime).toBe("05:30");
  });

  it("copes with a missing place and a finished event", () => {
    const event = toDayEvent(row({ location: null, finished_at: "2026-10-20T15:00:00Z" }));
    expect(event.location).toBe("");
    expect(event.finished).toBe(true);
  });
});
