/** Windows offered on the statistics page, as a number of whole hours ending with the current one. */
export const PERIODS = [
  { key: "24h", hours: 24, label: "24 heures" },
  { key: "7d", hours: 168, label: "7 jours" },
  { key: "30d", hours: 720, label: "30 jours" },
] as const;

/** Key of one of the {@link PERIODS}, as used in the `?period=` search parameter. */
export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Window shown when the URL names none (or an unknown one). */
export const DEFAULT_PERIOD: PeriodKey = "7d";

/** Reads `?period=`: a known key, otherwise the default. Never throws on odd input. */
export function parsePeriod(raw: string | string[] | undefined): PeriodKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PERIODS.find((period) => period.key === value)?.key ?? DEFAULT_PERIOD;
}

/** Number of hours of a window. */
export function periodHours(key: PeriodKey): number {
  return PERIODS.find((period) => period.key === key)?.hours ?? 168;
}

/** Link to the page for a window (the default one keeps a clean URL). */
export function periodHref(key: PeriodKey): string {
  return key === DEFAULT_PERIOD ? "/admin/statistics" : `/admin/statistics?period=${key}`;
}
