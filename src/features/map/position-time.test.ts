import { describe, expect, it } from "vitest";
import { formatAgo, formatDeclared } from "./position-time";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("formatAgo", () => {
  it("speaks in minutes, hours and days", () => {
    expect(formatAgo(ago(0), NOW)).toBe("à l'instant");
    expect(formatAgo(ago(5), NOW)).toBe("il y a 5 min");
    expect(formatAgo(ago(59), NOW)).toBe("il y a 59 min");
    expect(formatAgo(ago(60), NOW)).toBe("il y a 1 h");
    expect(formatAgo(ago(60 * 5 + 30), NOW)).toBe("il y a 5 h");
    expect(formatAgo(ago(60 * 24 * 3), NOW)).toBe("il y a 3 j");
  });

  it("never shows a negative or broken age", () => {
    expect(formatAgo(ago(-5), NOW)).toBe("à l'instant"); // clock skew: declared "in the future"
    expect(formatAgo("not a date", NOW)).toBe("à l'instant");
  });
});

describe("formatDeclared", () => {
  it("shows the clock for today and the day for older declarations (Europe/Paris)", () => {
    // 12:00Z is 14:00 in Paris in October (UTC+2).
    expect(formatDeclared(ago(5), NOW)).toBe("13:55");
    expect(formatDeclared(ago(60 * 24 * 2), NOW)).toMatch(/6 oct\.?,? 14:00/);
  });
});
