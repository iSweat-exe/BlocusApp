import { describe, expect, it } from "vitest";
import type { ActivityHour } from "@/lib/data/statistics";
import {
  busiestHours,
  hourOfDay,
  hourOfDayProfile,
  lastHours,
  summarizeActivity,
  summarizeSignups,
} from "./activity";

/** Hours starting at 2026-10-01T00:00Z (02:00 in Paris, summer time). */
const START = Date.parse("2026-10-01T00:00:00Z");
function series(
  values: { activeUsers: number; signups?: number; tracked?: boolean }[],
  start = START,
): ActivityHour[] {
  return values.map((value, index) => ({
    hour: new Date(start + index * 3_600_000).toISOString(),
    activeUsers: value.activeUsers,
    signups: value.signups ?? 0,
    tracked: value.tracked ?? true,
  }));
}

describe("lastHours", () => {
  it("keeps the end of the series, the current hour included", () => {
    const rows = series([{ activeUsers: 1 }, { activeUsers: 2 }, { activeUsers: 3 }]);
    expect(lastHours(rows, 2).map((row) => row.activeUsers)).toEqual([2, 3]);
    expect(lastHours(rows, 10)).toHaveLength(3);
    expect(lastHours(rows, 0)).toEqual([]);
  });
});

describe("summarizeActivity", () => {
  it("finds the peak and the mean of the measured hours", () => {
    const rows = series([{ activeUsers: 2 }, { activeUsers: 8 }, { activeUsers: 5 }]);
    const summary = summarizeActivity(rows);
    expect(summary.peak).toEqual({ hour: rows[1]!.hour, value: 8 });
    expect(summary.average).toBeCloseTo(5);
    expect(summary.trackedHours).toBe(3);
  });

  it("ignores the hours before the tracking started: their zero means unknown", () => {
    const rows = series([
      { activeUsers: 0, tracked: false },
      { activeUsers: 0, tracked: false },
      { activeUsers: 4 },
      { activeUsers: 0 },
    ]);
    const summary = summarizeActivity(rows);
    expect(summary.trackedHours).toBe(2);
    expect(summary.average).toBe(2);
  });

  it("prefers the most recent hour on a tie", () => {
    const rows = series([{ activeUsers: 6 }, { activeUsers: 6 }]);
    expect(summarizeActivity(rows).peak?.hour).toBe(rows[1]!.hour);
  });

  it("reports nothing when no hour was measured", () => {
    const rows = series([{ activeUsers: 0, tracked: false }]);
    expect(summarizeActivity(rows)).toEqual({ trackedHours: 0, peak: null, average: null });
    expect(summarizeActivity([])).toEqual({ trackedHours: 0, peak: null, average: null });
  });
});

describe("summarizeSignups", () => {
  it("totals the sign-ups and finds the best hour", () => {
    const rows = series([
      { activeUsers: 0, signups: 1 },
      { activeUsers: 0, signups: 4 },
      { activeUsers: 0, signups: 0 },
    ]);
    expect(summarizeSignups(rows)).toEqual({ total: 5, best: { hour: rows[1]!.hour, value: 4 } });
  });

  it("has no best hour when nobody signed up", () => {
    expect(summarizeSignups(series([{ activeUsers: 3 }]))).toEqual({ total: 0, best: null });
  });
});

describe("hourOfDay", () => {
  it("reads the hour in Paris time, summer and winter", () => {
    expect(hourOfDay("2026-10-01T00:00:00Z")).toBe(2);
    expect(hourOfDay("2026-12-01T00:00:00Z")).toBe(1);
    expect(hourOfDay("2026-10-01T22:30:00Z")).toBe(0);
  });

  it("accepts another time zone", () => {
    expect(hourOfDay("2026-10-01T00:00:00Z", "UTC")).toBe(0);
  });
});

describe("hourOfDayProfile", () => {
  it("averages the same hour of the day over several days, in Paris time", () => {
    // Two days, from 02:00 Paris: the hour of day 2 holds 10 then 20, every other hour holds 0.
    const values = Array.from({ length: 49 }, (_, i) => ({
      activeUsers: i === 0 ? 10 : i === 24 ? 20 : 0,
    }));
    const profile = hourOfDayProfile(series(values));

    expect(profile).toHaveLength(24);
    expect(profile[2]).toEqual({ hour: 2, average: 15, samples: 2 });
    expect(profile[3]).toEqual({ hour: 3, average: 0, samples: 2 });
  });

  it("leaves out the hour in progress and the hours that were not measured", () => {
    const rows = series([
      { activeUsers: 9, tracked: false },
      { activeUsers: 4 },
      { activeUsers: 100 },
    ]);
    const profile = hourOfDayProfile(rows);

    expect(profile[2]).toEqual({ hour: 2, average: null, samples: 0 });
    expect(profile[3]).toEqual({ hour: 3, average: 4, samples: 1 });
    expect(profile[4]).toEqual({ hour: 4, average: null, samples: 0 });
  });
});

describe("busiestHours", () => {
  it("returns the hours sharing the highest mean", () => {
    const profile = [
      { hour: 0, average: 1, samples: 2 },
      { hour: 1, average: 5, samples: 2 },
      { hour: 2, average: 5, samples: 2 },
      { hour: 3, average: null, samples: 0 },
    ];
    expect(busiestHours(profile).map((slot) => slot.hour)).toEqual([1, 2]);
  });

  it("returns nothing when nobody was ever seen", () => {
    expect(busiestHours([{ hour: 0, average: 0, samples: 3 }])).toEqual([]);
    expect(busiestHours([{ hour: 0, average: null, samples: 0 }])).toEqual([]);
  });
});
