import type { CSSProperties } from "react";
import type { DayEvent } from "./calendar-types";

/**
 * Hues (OKLCH degrees) of the event colours: red, orange, yellow, green, teal, blue, violet, pink. Spread around the
 * wheel so that two neighbours are never mistaken for each other.
 */
export const EVENT_HUES = [25, 60, 95, 150, 190, 245, 285, 340] as const;

/** FNV-1a: a small, stable hash of a string (the same id always gives the same number). */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * A colour for each event of one day. It looks random but is stable: it comes from the id, so an event keeps its
 * colour in the week view, the day view and the list, on the server and in the browser (a real random draw would
 * differ between the two and flash at hydration). Events that follow each other in time never get the same colour:
 * when the draw repeats the previous one, the next hue of the wheel is taken.
 */
export function assignHues(events: readonly DayEvent[]): Map<string, number> {
  const ordered = [...events].sort(
    (a, b) => (a.startHour ?? 0) - (b.startHour ?? 0) || a.id.localeCompare(b.id),
  );
  const hues = new Map<string, number>();
  let previous = -1;
  for (const event of ordered) {
    let index = hashOf(event.id) % EVENT_HUES.length;
    if (index === previous) index = (index + 1) % EVENT_HUES.length;
    hues.set(event.id, EVENT_HUES[index]!);
    previous = index;
  }
  return hues;
}

/** The colour of an event as a mid-tone that reads on a light and on a dark background. */
export const solidColor = (hue: number) => `oklch(0.64 0.17 ${hue})`;

/** The colour of the small dot that ties an item of a list to its block on the timeline. */
export const dotStyle = (hue: number, finished: boolean): CSSProperties => ({
  backgroundColor: finished
    ? "color-mix(in srgb, var(--foreground) 30%, transparent)"
    : solidColor(hue),
});

/**
 * The look of an event block, copied from the iOS Calendar: a tinted background, a solid bar on the left and text in
 * a darker (or, in the dark theme, lighter) shade of the same colour. Everything is mixed with the theme variables, so
 * the light and the dark theme each get a fitting block without a second palette. A finished event goes grey.
 * @param barPx - Width of the bar on the left.
 */
export function blockStyle(hue: number, finished: boolean, barPx = 3): CSSProperties {
  if (finished) {
    return {
      backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)",
      borderLeft: `${barPx}px solid color-mix(in srgb, var(--foreground) 30%, transparent)`,
      color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
    };
  }
  const solid = solidColor(hue);
  return {
    backgroundColor: `color-mix(in oklch, ${solid} 18%, var(--background))`,
    borderLeft: `${barPx}px solid ${solid}`,
    color: `color-mix(in oklch, ${solid} 55%, var(--foreground))`,
  };
}
