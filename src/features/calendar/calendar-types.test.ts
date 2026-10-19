import { describe, expect, it } from "vitest";
import { buildCalendarHref, resolveCalendarViewMode } from "./calendar-types";

describe("resolveCalendarViewMode", () => {
  it("uses explicit view parameter when valid", () => {
    expect(resolveCalendarViewMode({ view: "week" })).toBe("week");
    expect(resolveCalendarViewMode({ view: "day" })).toBe("day");
    expect(resolveCalendarViewMode({ view: "month" })).toBe("month");
  });

  it("infers week view when week parameter is present", () => {
    expect(resolveCalendarViewMode({ week: "2026-42" })).toBe("week");
    expect(resolveCalendarViewMode({ week: "2026-W30" })).toBe("week");
  });

  it("infers day view when only day is present", () => {
    expect(resolveCalendarViewMode({ day: "2026-10-14" })).toBe("day");
    expect(resolveCalendarViewMode({ day: "2026-10-14", month: "2026-10" })).toBe("month");
  });

  it("falls back to month view by default", () => {
    expect(resolveCalendarViewMode({})).toBe("month");
    expect(resolveCalendarViewMode({ view: "invalid" })).toBe("month");
  });
});

describe("buildCalendarHref", () => {
  it("builds month view href", () => {
    expect(buildCalendarHref({ view: "month", day: "2026-10-14", month: "2026-10" })).toBe(
      "/calendar?view=month&month=2026-10&day=2026-10-14",
    );
  });

  it("builds week view href with week number", () => {
    expect(buildCalendarHref({ view: "week", day: "2026-10-14" })).toBe(
      "/calendar?view=week&week=2026-42&day=2026-10-14",
    );
    expect(buildCalendarHref({ view: "week", day: "2026-10-14", week: "2026-30" })).toBe(
      "/calendar?view=week&week=2026-30&day=2026-10-14",
    );
  });

  it("builds day view href", () => {
    expect(buildCalendarHref({ view: "day", day: "2026-10-14" })).toBe(
      "/calendar?view=day&day=2026-10-14",
    );
  });
});
