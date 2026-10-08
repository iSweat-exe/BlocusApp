import { describe, expect, it } from "vitest";
import { formatAge, formatBytes, formatMs, sparklinePoints } from "./format";

describe("formatBytes", () => {
  it("uses Mo then Go, with a decimal comma", () => {
    expect(formatBytes(12.34 * 1024 * 1024)).toBe("12,3 Mo");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1,5 Go");
  });
});

describe("formatMs", () => {
  it("shows milliseconds, seconds, or a dash when unknown", () => {
    expect(formatMs(85)).toBe("85 ms");
    expect(formatMs(1250)).toBe("1,3 s");
    expect(formatMs(null)).toBe("—");
  });
});

describe("formatAge", () => {
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);
  it.each([
    [30_000, "à l'instant"],
    [5 * 60_000, "il y a 5 min"],
    [3 * 3_600_000, "il y a 3 h"],
    [2 * 86_400_000, "il y a 2 j"],
    [-60_000, "à l'instant"],
  ])("%i ms ago is %s", (elapsed, label) => {
    expect(formatAge(now - elapsed, now)).toBe(label);
  });
});

describe("sparklinePoints", () => {
  it("spreads the values over the width, 100 at the top", () => {
    expect(sparklinePoints([100, 50, 0], 100, 40)).toBe("0,0 50,20 100,40");
  });

  it("clamps out-of-range values, draws one value flat and none as empty", () => {
    expect(sparklinePoints([150, -5], 10, 10)).toBe("0,0 10,10");
    expect(sparklinePoints([100], 10, 10)).toBe("0,0");
    expect(sparklinePoints([], 10, 10)).toBe("");
  });
});
