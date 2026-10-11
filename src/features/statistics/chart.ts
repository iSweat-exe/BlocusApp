import type { ActivityHour } from "@/lib/data/statistics";

/** Smallest "round" scale (1, 2, 5, 10, 20, 50…) that holds `max`, so the top of a chart reads well. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((step) => step * magnitude).find((candidate) => candidate >= max) ?? max;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Points of the activity line and of the polygon under it, in a `width` x `height` box. */
export type AreaGeometry = { line: string; area: string };

/**
 * Line and area of the active users per hour. Only measured hours are drawn (they form the end of the series:
 * activity is measured from some hour on); the x position still follows the whole window, so a window that
 * starts before the tracking leaves its left part empty. `null` when no hour was measured.
 */
export function areaGeometry(
  rows: readonly ActivityHour[],
  width: number,
  height: number,
  max: number,
): AreaGeometry | null {
  const step = rows.length > 1 ? width / (rows.length - 1) : 0;
  const points = rows.flatMap((row, index) =>
    row.tracked
      ? [
          {
            x: round(index * step),
            y: round(height - (Math.min(row.activeUsers, max) / max) * height),
          },
        ]
      : [],
  );
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return { line, area: `${line} ${last.x},${height} ${first.x},${height}` };
}

/**
 * Path of one bar per non-zero value, drawn in a `width` x `height` box (zero values draw nothing, which keeps
 * the markup small for a 30-day window). A non-zero value always shows at least one unit of height.
 */
export function barsPath(
  values: readonly number[],
  width: number,
  height: number,
  max: number,
): string {
  if (values.length === 0) return "";
  const slot = width / values.length;
  const barWidth = round(slot * 0.78);
  return values
    .flatMap((value, index) => {
      if (!(value > 0)) return [];
      const barHeight = Math.max(1, (Math.min(value, max) / max) * height);
      const x = round(index * slot + (slot - barWidth) / 2);
      return [`M${x},${height}V${round(height - barHeight)}h${barWidth}V${height}z`];
    })
    .join("");
}
