import { describe, expect, it } from "vitest";
import type { DayEvent } from "./calendar-types";
import { assignHues, blockStyle, dotStyle, EVENT_HUES, solidColor } from "./event-colors";

const event = (id: string, startHour: number): DayEvent => ({
  id,
  title: id,
  location: "",
  time: "",
  finished: false,
  startHour,
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("assignHues", () => {
  it("gives the same colour to the same event every time, whatever the order it is asked in", () => {
    const events = [event(uuid(1), 9), event(uuid(2), 10), event(uuid(3), 11)];
    const first = assignHues(events);
    const second = assignHues([...events].reverse());
    expect([...second]).toEqual(expect.arrayContaining([...first]));
    expect(second.size).toBe(3);
  });

  it("only uses the hues of the palette", () => {
    const hues = assignHues(Array.from({ length: 40 }, (_, n) => event(uuid(n), n % 24)));
    for (const hue of hues.values()) expect(EVENT_HUES).toContain(hue);
  });

  it("looks random: a series of events does not all get one colour", () => {
    const hues = assignHues(Array.from({ length: 40 }, (_, n) => event(uuid(n), n % 24)));
    expect(new Set(hues.values()).size).toBeGreaterThanOrEqual(5);
  });

  it("never gives the same colour to two events that follow each other in time", () => {
    const events = Array.from({ length: 300 }, (_, n) => event(uuid(n * 7919), n * 0.07));
    const hues = assignHues(events);
    const ordered = [...events].sort((a, b) => a.startHour! - b.startHour!);
    for (let index = 1; index < ordered.length; index += 1) {
      expect(hues.get(ordered[index]!.id)).not.toBe(hues.get(ordered[index - 1]!.id));
    }
  });
});

describe("event styles", () => {
  it("tints the block, adds a solid bar and darkens the text, all from the same colour", () => {
    const style = blockStyle(245, false);
    const solid = solidColor(245);
    expect(solid).toBe("oklch(0.64 0.17 245)");
    expect(style.borderLeft).toBe(`3px solid ${solid}`);
    // Mixed with the theme variables: one rule serves the light and the dark theme.
    expect(String(style.backgroundColor)).toContain("var(--background)");
    expect(String(style.color)).toContain("var(--foreground)");
  });

  it("takes the width of the bar as a parameter", () => {
    expect(blockStyle(25, false, 2).borderLeft).toContain("2px solid");
  });

  it("turns a finished event grey, whatever its hue", () => {
    const style = blockStyle(245, true);
    expect(JSON.stringify(style)).not.toContain("245");
    expect(String(style.borderLeft)).toContain("var(--foreground)");
  });

  it("gives the dot of the list the colour of the block, or a grey when finished", () => {
    expect(dotStyle(150, false).backgroundColor).toBe(solidColor(150));
    expect(String(dotStyle(150, true).backgroundColor)).toContain("var(--foreground)");
  });
});
