import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX, LOCATION_MAX, parseEventInput, TITLE_MAX } from "./schema";

// 2026-10-07 12:00 UTC = 14:00 in Paris (summer time).
const NOW = new Date("2026-10-07T12:00:00Z");
const VALID = {
  title: "  Rassemblement ",
  description: " Place centrale. ",
  location: " Gare ",
  date: "2026-10-08",
  time: "14:30",
  endTime: "16:00",
};

describe("parseEventInput", () => {
  it("trims, converts Paris wall-clock times to UTC and accepts an end time", () => {
    expect(parseEventInput(VALID, NOW, true)).toEqual({
      ok: true,
      value: {
        title: "Rassemblement",
        description: "Place centrale.",
        location: "Gare",
        startsAt: new Date("2026-10-08T12:30:00Z"),
        endsAt: new Date("2026-10-08T14:00:00Z"),
      },
    });
  });

  it("makes description, location and end time optional", () => {
    const result = parseEventInput(
      { ...VALID, description: undefined, location: "", endTime: "" },
      NOW,
      true,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { description: "", location: "", endsAt: null },
    });
  });

  it("requires a title, a valid date and a valid start time", () => {
    const result = parseEventInput(
      { ...VALID, title: " ", date: "2026-02-30", time: "25:00" },
      NOW,
      true,
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        title: expect.any(String),
        date: expect.any(String),
        time: expect.any(String),
      },
    });
  });

  it("enforces the maximum lengths", () => {
    const result = parseEventInput(
      {
        ...VALID,
        title: "x".repeat(TITLE_MAX + 1),
        description: "y".repeat(DESCRIPTION_MAX + 1),
        location: "z".repeat(LOCATION_MAX + 1),
      },
      NOW,
      true,
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        title: expect.any(String),
        description: expect.any(String),
        location: expect.any(String),
      },
    });
  });

  it("refuses an end that is not after the start, and a malformed end", () => {
    expect(parseEventInput({ ...VALID, endTime: "14:30" }, NOW, true)).toMatchObject({
      ok: false,
      fieldErrors: { endTime: expect.stringContaining("après") },
    });
    expect(parseEventInput({ ...VALID, endTime: "9h" }, NOW, true)).toMatchObject({
      ok: false,
      fieldErrors: { endTime: expect.any(String) },
    });
  });

  it("refuses a start in the past on creation, with the same tolerance as the database", () => {
    const past = { ...VALID, date: "2026-10-07", time: "13:00", endTime: "" }; // 11:00 UTC
    expect(parseEventInput(past, NOW, true)).toMatchObject({
      ok: false,
      fieldErrors: { time: expect.stringContaining("passé") },
    });
    const justNow = { ...VALID, date: "2026-10-07", time: "13:58", endTime: "" }; // 2 min ago
    expect(parseEventInput(justNow, NOW, true).ok).toBe(true);
  });

  it("allows a past start when editing (the database still guards moving it)", () => {
    const past = { ...VALID, date: "2026-10-07", time: "08:00", endTime: "" };
    expect(parseEventInput(past, NOW, false).ok).toBe(true);
  });
});
