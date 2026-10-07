import { describe, expect, it } from "vitest";
import { formatAnnouncementDate } from "./date";

// 2026-10-07 17:35 UTC = 19:35 in Paris (summer time).
const NOW = new Date("2026-10-07T17:35:00Z");

describe("formatAnnouncementDate", () => {
  it("says today and yesterday, with the Paris time", () => {
    expect(formatAnnouncementDate("2026-10-07T17:00:00Z", NOW)).toBe("Aujourd'hui, 19:00");
    expect(formatAnnouncementDate("2026-10-06T13:11:00Z", NOW)).toBe("Hier, 15:11");
  });

  it("uses the Paris day, not the UTC day, around midnight", () => {
    // 22:30 UTC on the 6th is 00:30 on the 7th in Paris: that is today.
    expect(formatAnnouncementDate("2026-10-06T22:30:00Z", NOW)).toBe("Aujourd'hui, 00:30");
  });

  it("shows a short date, with the year only when it is not the current one", () => {
    expect(formatAnnouncementDate("2026-10-01T07:00:00Z", NOW)).toBe("1 oct., 09:00");
    expect(formatAnnouncementDate("2025-12-24T09:00:00Z", NOW)).toBe("24 déc. 2025, 10:00");
  });
});
