import type { Count } from "@/lib/data/statistics";
import { STATS_TIME_ZONE } from "./activity";

const countFormat = new Intl.NumberFormat("fr-FR");
const averageFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const hourFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  timeZone: STATS_TIME_ZONE,
});
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: STATS_TIME_ZONE,
});
const measuredFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STATS_TIME_ZONE,
});

/** `1 234`: an integer in French. */
export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** `3,2`: a mean with at most one decimal, in French. */
export function formatAverage(value: number): string {
  return averageFormat.format(value);
}

/** `sam. 11 oct., 14 h`: a whole hour, in Paris time. */
export function formatHour(iso: string): string {
  return hourFormat.format(new Date(iso));
}

/** `11 oct.`: a day, in Paris time. */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** `11/10 14:05`: when the figures were read, in Paris time. */
export function formatMeasuredAt(iso: string): string {
  return measuredFormat.format(new Date(iso));
}

/** Share of `part` in `total` as a whole percentage, `null` when there is nothing to compare to. */
export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

/** A count with its share of the total, for the distribution lists. */
export type Share = Count & { percent: number };

/** Adds each entry's share of the sum, biggest first (ties by key); entries without accounts are dropped. */
export function withShares(counts: readonly Count[]): Share[] {
  const sum = counts.reduce((acc, count) => acc + count.total, 0);
  return counts
    .filter((count) => count.total > 0)
    .toSorted((a, b) => b.total - a.total || a.key.localeCompare(b.key))
    .map((count) => ({ ...count, percent: percent(count.total, sum) ?? 0 }));
}

const PROVIDER_LABELS: Record<string, string> = {
  discord: "Discord",
  google: "Google",
  email: "E-mail",
  unknown: "Inconnue",
};

/** Name of a sign-up provider; an unknown provider is shown capitalised rather than hidden. */
export function providerLabel(key: string): string {
  return PROVIDER_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
