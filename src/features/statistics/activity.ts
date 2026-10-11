import type { ActivityHour } from "@/lib/data/statistics";

/** Time zone used to read hours of the day: the demonstration happens in France. */
export const STATS_TIME_ZONE = "Europe/Paris";

/** The last `hours` rows of a series (the series ends with the current hour). */
export function lastHours(rows: readonly ActivityHour[], hours: number): ActivityHour[] {
  // `slice(-0)` would return everything.
  return hours > 0 ? rows.slice(-hours) : [];
}

/** Highest point of a series. */
export type Peak = { hour: string; value: number };

/** What the activity of a window says: how many hours were measured, the busiest one and the mean. */
export type ActivitySummary = {
  trackedHours: number;
  /** Busiest measured hour (the most recent one on a tie), `null` when nothing was measured. */
  peak: Peak | null;
  /** Mean of distinct active users per measured hour, `null` when nothing was measured. */
  average: number | null;
};

/** Summarises the measured hours only: before the tracking started, "0" means "unknown". */
export function summarizeActivity(rows: readonly ActivityHour[]): ActivitySummary {
  let peak: Peak | null = null;
  let sum = 0;
  let trackedHours = 0;
  for (const row of rows) {
    if (!row.tracked) continue;
    trackedHours += 1;
    sum += row.activeUsers;
    if (!peak || row.activeUsers >= peak.value) peak = { hour: row.hour, value: row.activeUsers };
  }
  return { trackedHours, peak, average: trackedHours > 0 ? sum / trackedHours : null };
}

/** What the sign-ups of a window say. */
export type SignupSummary = {
  total: number;
  /** Hour with the most sign-ups (the most recent one on a tie), `null` when there was none. */
  best: Peak | null;
};

/** Total and busiest hour of the sign-ups of a window. */
export function summarizeSignups(rows: readonly ActivityHour[]): SignupSummary {
  let best: Peak | null = null;
  let total = 0;
  for (const row of rows) {
    total += row.signups;
    if (row.signups > 0 && (!best || row.signups >= best.value)) {
      best = { hour: row.hour, value: row.signups };
    }
  }
  return { total, best };
}

/** Average activity at one hour of the day. */
export type HourOfDay = {
  /** 0 to 23, in the time zone of the profile. */
  hour: number;
  /** Mean of distinct active users at this hour over the measured days, `null` without any measure. */
  average: number | null;
  /** Number of measured hours behind the mean. */
  samples: number;
};

/** Hour of the day (0-23) of an instant, in a time zone. */
export function hourOfDay(iso: string, timeZone: string = STATS_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(iso));
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
}

/**
 * Average activity for each hour of the day (24 entries, 0 to 23), over the measured hours of the series.
 * The last row is the hour in progress, whose count is still growing: it is left out.
 */
export function hourOfDayProfile(
  rows: readonly ActivityHour[],
  timeZone: string = STATS_TIME_ZONE,
): HourOfDay[] {
  const sums = Array.from({ length: 24 }, () => 0);
  const samples = Array.from({ length: 24 }, () => 0);
  for (const row of rows.slice(0, -1)) {
    if (!row.tracked) continue;
    const slot = hourOfDay(row.hour, timeZone);
    sums[slot] = (sums[slot] ?? 0) + row.activeUsers;
    samples[slot] = (samples[slot] ?? 0) + 1;
  }
  return sums.map((sum, hour) => {
    const count = samples[hour] ?? 0;
    return { hour, average: count > 0 ? sum / count : null, samples: count };
  });
}

/** Busiest hours of the day: those sharing the highest mean (empty when nothing was measured). */
export function busiestHours(profile: readonly HourOfDay[]): HourOfDay[] {
  const top = Math.max(0, ...profile.map((slot) => slot.average ?? 0));
  return top > 0 ? profile.filter((slot) => slot.average === top) : [];
}
