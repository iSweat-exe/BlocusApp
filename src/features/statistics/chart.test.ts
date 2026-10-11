import { describe, expect, it } from "vitest";
import type { ActivityHour } from "@/lib/data/statistics";
import { areaGeometry, barsPath, niceMax } from "./chart";

const row = (activeUsers: number, tracked = true): ActivityHour => ({
  hour: "2026-10-01T00:00:00Z",
  activeUsers,
  signups: 0,
  tracked,
});

describe("niceMax", () => {
  it.each([
    [0, 1],
    [-3, 1],
    [1, 1],
    [3, 5],
    [5, 5],
    [6, 10],
    [11, 20],
    [47, 50],
    [51, 100],
    [230, 500],
  ])("rounds %d up to %d", (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe("areaGeometry", () => {
  it("draws the line from the left to the right edge, the maximum at the top", () => {
    const geometry = areaGeometry([row(0), row(10), row(5)], 300, 64, 10);
    expect(geometry?.line).toBe("0,64 150,0 300,32");
  });

  it("closes the area along the bottom edge", () => {
    const geometry = areaGeometry([row(0), row(10)], 300, 64, 10);
    expect(geometry?.area).toBe("0,64 300,0 300,64 0,64");
  });

  it("starts where the tracking started, keeping the x scale of the whole window", () => {
    const geometry = areaGeometry([row(0, false), row(0, false), row(10), row(10)], 300, 64, 10);
    expect(geometry?.line).toBe("200,0 300,0");
  });

  it("clamps a value above the scale", () => {
    expect(areaGeometry([row(50), row(50)], 300, 64, 10)?.line).toBe("0,0 300,0");
  });

  it("returns null when no hour was measured", () => {
    expect(areaGeometry([row(0, false), row(0, false)], 300, 64, 10)).toBeNull();
    expect(areaGeometry([], 300, 64, 10)).toBeNull();
  });

  it("draws a single measured hour as a point", () => {
    expect(areaGeometry([row(5)], 300, 64, 10)?.line).toBe("0,32");
  });
});

describe("barsPath", () => {
  it("draws one bar per non-zero value and nothing for zeros", () => {
    const path = barsPath([0, 5, 0, 10], 100, 50, 10);
    expect(path.match(/M/g)).toHaveLength(2);
    // The second slot starts at x=25 and is 25 wide: the 19.5-wide bar is centred in it (27.75).
    expect(path).toContain("M27.75,50V25h19.5V50z");
    expect(path).toContain("V0h19.5V50z");
  });

  it("gives a small value at least one unit of height", () => {
    expect(barsPath([1], 100, 50, 1000)).toContain("V49");
  });

  it("is empty without values or without a non-zero value", () => {
    expect(barsPath([], 100, 50, 10)).toBe("");
    expect(barsPath([0, 0], 100, 50, 10)).toBe("");
  });
});
