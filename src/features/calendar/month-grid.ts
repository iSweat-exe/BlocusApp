import { addDays, parseMonthKey } from "./time";

/** One cell of the month grid. */
export type GridDay = { key: string; day: number; inMonth: boolean };

const pad = (value: number) => String(value).padStart(2, "0");

/** Weeks (Monday first) covering a month, padded with the neighbouring days to full weeks. */
export function monthGrid(monthKey: string): GridDay[][] {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return [];
  const { year, month } = parsed;

  const firstKey = `${year}-${pad(month)}-01`;
  const weekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks = Math.ceil((weekday + daysInMonth) / 7);

  const start = addDays(firstKey, -weekday);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, index) => {
      const key = addDays(start, week * 7 + index);
      return { key, day: Number(key.slice(8, 10)), inMonth: key.startsWith(monthKey) };
    }),
  );
}

/** Month key shifted by a number of months (`2026-12` + 1 = `2027-01`). */
export function shiftMonth(monthKey: string, delta: number): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}
