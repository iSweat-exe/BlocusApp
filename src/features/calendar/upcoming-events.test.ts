import { describe, expect, it } from "vitest";
import { upcomingOf } from "./upcoming-events";

const NOW = Date.parse("2026-10-20T10:00:00Z");
const ev = (
  starts_at: string,
  ends_at: string | null = null,
  finished_at: string | null = null,
) => ({
  starts_at,
  ends_at,
  finished_at,
});

describe("upcomingOf", () => {
  it("keeps what is coming and what is under way", () => {
    const coming = ev("2026-10-20T12:00:00Z");
    const running = ev("2026-10-20T09:00:00Z", "2026-10-20T11:00:00Z");
    expect(upcomingOf([coming, running], NOW)).toEqual([coming, running]);
  });

  it("drops what is over, finished or without end and older than the default hour", () => {
    expect(upcomingOf([ev("2026-10-20T08:00:00Z", "2026-10-20T09:00:00Z")], NOW)).toEqual([]);
    expect(upcomingOf([ev("2026-10-20T12:00:00Z", null, "2026-10-20T09:59:00Z")], NOW)).toEqual([]);
    expect(upcomingOf([ev("2026-10-20T08:30:00Z")], NOW)).toEqual([]);
  });

  it("takes an event without end as lasting one hour", () => {
    const justStarted = ev("2026-10-20T09:30:00Z");
    expect(upcomingOf([justStarted], NOW)).toEqual([justStarted]);
  });
});
