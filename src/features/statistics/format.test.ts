import { describe, expect, it } from "vitest";
import {
  formatAverage,
  formatCount,
  formatDay,
  formatHour,
  formatMeasuredAt,
  percent,
  providerLabel,
  withShares,
} from "./format";

describe("number formats", () => {
  it("formats integers and means in French", () => {
    expect(formatCount(1234)).toMatch(/^1\s234$/);
    expect(formatAverage(3.25)).toBe("3,3");
    expect(formatAverage(4)).toBe("4");
  });
});

describe("date formats (Paris time)", () => {
  it("names the hour, the day and the moment of the reading", () => {
    // 12:00 UTC is 14:00 in Paris on 11 October 2026 (a Sunday, summer time).
    expect(formatHour("2026-10-11T12:00:00Z")).toMatch(/11 oct\.?,? 14\s?h/);
    expect(formatDay("2026-10-11T12:00:00Z")).toMatch(/11 oct/);
    expect(formatMeasuredAt("2026-10-11T12:05:00Z")).toMatch(/11\/10.*14:05/);
  });
});

describe("percent", () => {
  it("rounds to a whole number", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });

  it("is null without anything to compare to", () => {
    expect(percent(0, 0)).toBeNull();
  });
});

describe("withShares", () => {
  it("sorts by total, then key, and adds each share", () => {
    const shares = withShares([
      { key: "b", total: 1 },
      { key: "a", total: 1 },
      { key: "c", total: 2 },
    ]);
    expect(shares.map((share) => share.key)).toEqual(["c", "a", "b"]);
    expect(shares.map((share) => share.percent)).toEqual([50, 25, 25]);
  });

  it("drops empty entries and copes with an empty list", () => {
    expect(withShares([{ key: "x", total: 0 }])).toEqual([]);
    expect(withShares([])).toEqual([]);
  });
});

describe("providerLabel", () => {
  it("names the known providers and capitalises the others", () => {
    expect(providerLabel("discord")).toBe("Discord");
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("unknown")).toBe("Inconnue");
    expect(providerLabel("github")).toBe("Github");
  });
});
