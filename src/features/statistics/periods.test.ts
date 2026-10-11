import { describe, expect, it } from "vitest";
import { DEFAULT_PERIOD, parsePeriod, periodHours, periodHref } from "./periods";

describe("parsePeriod", () => {
  it("accepts the known windows", () => {
    expect(parsePeriod("24h")).toBe("24h");
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("30d")).toBe("30d");
  });

  it("falls back to the default for anything else", () => {
    expect(parsePeriod(undefined)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("")).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("1y")).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("<script>")).toBe(DEFAULT_PERIOD);
  });

  it("takes the first value when the parameter is repeated", () => {
    expect(parsePeriod(["30d", "24h"])).toBe("30d");
    expect(parsePeriod([])).toBe(DEFAULT_PERIOD);
  });
});

describe("periodHours", () => {
  it("gives the number of hours of each window", () => {
    expect(periodHours("24h")).toBe(24);
    expect(periodHours("7d")).toBe(168);
    expect(periodHours("30d")).toBe(720);
  });
});

describe("periodHref", () => {
  it("keeps the default window on the bare URL", () => {
    expect(periodHref(DEFAULT_PERIOD)).toBe("/admin/statistics");
    expect(periodHref("24h")).toBe("/admin/statistics?period=24h");
    expect(periodHref("30d")).toBe("/admin/statistics?period=30d");
  });
});
