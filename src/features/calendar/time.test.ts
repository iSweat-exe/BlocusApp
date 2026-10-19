import { describe, expect, it } from "vitest";
import { monthGrid, shiftMonth } from "./month-grid";
import {
  addDays,
  dayKeyFromWeek,
  dayKeyOf,
  dayRangeUtc,
  formatDayKeyLong,
  formatMonthLabel,
  formatTime,
  formatTimeRange,
  formatWeekLabel,
  formatWeekRange,
  mondayOf,
  monthKeyOf,
  parseDayKey,
  parseMonthKey,
  parseWeekKey,
  timeToHour,
  weekDaysOf,
  weekdayOf,
  weekKeyOf,
  zonedToUtc,
} from "./time";

describe("day and month keys", () => {
  it("parses valid keys and rejects impossible or malformed ones", () => {
    expect(parseDayKey("2026-10-07")).toEqual({ year: 2026, month: 10, day: 7 });
    expect(parseDayKey("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    for (const bad of ["2026-02-30", "2026-13-01", "2026-1-1", "x", "", null, 5]) {
      expect(parseDayKey(bad)).toBeNull();
    }
    expect(parseMonthKey("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonthKey("2026-00")).toBeNull();
    expect(parseMonthKey("2026-10-01")).toBeNull();
  });

  it("does calendar arithmetic across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(monthKeyOf("2026-10-07")).toBe("2026-10");
    expect(() => addDays("nope", 1)).toThrow();
  });
});

describe("time zone conversion (Europe/Paris)", () => {
  it("converts wall-clock time to UTC in summer and winter", () => {
    expect(zonedToUtc("2026-10-07", 14, 30).toISOString()).toBe("2026-10-07T12:30:00.000Z");
    expect(zonedToUtc("2026-01-15", 14, 30).toISOString()).toBe("2026-01-15T13:30:00.000Z");
  });

  it("gives the Paris day of an instant, even close to midnight", () => {
    expect(dayKeyOf(new Date("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
    expect(dayKeyOf(new Date("2026-10-07T21:30:00Z"))).toBe("2026-10-07");
  });

  it("computes day bounds that follow the DST changes", () => {
    const hours = (key: string) => {
      const { start, end } = dayRangeUtc(key);
      return (end.getTime() - start.getTime()) / 3_600_000;
    };
    expect(hours("2026-10-07")).toBe(24);
    expect(hours("2026-10-25")).toBe(25); // clocks go back
    expect(hours("2026-03-29")).toBe(23); // clocks go forward
  });

  it("formats times and days in French", () => {
    expect(formatTime("2026-10-07T12:30:00Z")).toBe("14:30");
    expect(formatTimeRange("2026-10-07T12:30:00Z", "2026-10-07T14:00:00Z")).toBe("14:30 – 16:00");
    expect(formatTimeRange("2026-10-07T12:30:00Z", null)).toBe("14:30");
    expect(formatDayKeyLong("2026-10-07")).toBe("mercredi 7 octobre 2026");
    expect(formatMonthLabel("2026-10")).toBe("octobre 2026");
    expect(formatMonthLabel("junk")).toBe("junk");
    expect(timeToHour("2026-10-07T12:30:00Z")).toBe(14.5);
    expect(timeToHour("2026-10-07T06:00:00Z")).toBe(8);
  });
});

describe("month grid", () => {
  it("builds Monday-first weeks padded with neighbouring days", () => {
    const grid = monthGrid("2026-10");
    expect(grid).toHaveLength(5);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0]?.[0]).toEqual({ key: "2026-09-28", day: 28, inMonth: false });
    expect(grid[0]?.[3]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(grid.at(-1)?.at(-1)).toEqual({ key: "2026-11-01", day: 1, inMonth: false });
    expect(grid.flat().filter((cell) => cell.inMonth)).toHaveLength(31);
  });

  it("handles a month starting on Monday and a 6-week month", () => {
    expect(monthGrid("2026-06")[0]?.[0]?.key).toBe("2026-06-01");
    expect(monthGrid("2027-02")).toHaveLength(4); // 28 days starting on a Monday
    expect(monthGrid("2026-02")).toHaveLength(5);
    expect(monthGrid("2025-06")).toHaveLength(6);
    expect(monthGrid("bad")).toEqual([]);
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("bad", 1)).toBe("bad");
  });
});

describe("week calculations and keys", () => {
  it("determines weekday (Monday = 0, Sunday = 6)", () => {
    expect(weekdayOf("2026-10-12")).toBe(0); // Monday
    expect(weekdayOf("2026-10-14")).toBe(2); // Wednesday
    expect(weekdayOf("2026-10-18")).toBe(6); // Sunday
  });

  it("calculates Monday and 7 days of the week", () => {
    expect(mondayOf("2026-10-14")).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    const days = weekDaysOf("2026-10-14");
    expect(days).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("calculates ISO week keys", () => {
    expect(weekKeyOf("2026-10-14")).toBe("2026-42");
    // New year transition: 2026-01-01 is Thursday -> Week 1 of 2026
    expect(weekKeyOf("2026-01-01")).toBe("2026-01");
    // 2025-12-31 was Wednesday in week 1 of 2026 (starts Mon Dec 29 2025)
    expect(weekKeyOf("2025-12-31")).toBe("2026-01");
  });

  it("parses valid and invalid week keys", () => {
    expect(parseWeekKey("2026-42")).toEqual({ year: 2026, week: 42 });
    expect(parseWeekKey("2026-W42")).toEqual({ year: 2026, week: 42 });
    expect(parseWeekKey("2026-01")).toEqual({ year: 2026, week: 1 });
    expect(parseWeekKey("2026-0")).toBeNull();
    expect(parseWeekKey("2026-54")).toBeNull();
    expect(parseWeekKey("invalid")).toBeNull();
    expect(parseWeekKey(null)).toBeNull();
  });

  it("resolves dayKeyFromWeek", () => {
    expect(dayKeyFromWeek("2026-42")).toBe("2026-10-12");
    expect(dayKeyFromWeek("2026-42", 2)).toBe("2026-10-14");
    expect(dayKeyFromWeek("bad")).toBeNull();
  });

  it("formats week label and range in French", () => {
    expect(formatWeekLabel("2026-42")).toBe("Semaine 42");
    expect(formatWeekRange("2026-10-14")).toBe("12 – 18 oct. 2026");
    expect(formatWeekRange("2026-09-30")).toBe("28 sept. – 4 oct. 2026");
  });
});
