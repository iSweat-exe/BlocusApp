/** Time zone of the events: they are stored in UTC and shown/entered in this zone. */
export const EVENT_TIME_ZONE = "Europe/Paris";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Fields = { year: number; month: number; day: number; hour: number; minute: number };

function zonedFields(date: Date): Fields {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/** Offset of the event time zone from UTC at an instant, in milliseconds (DST-aware). */
function zoneOffsetMs(date: Date): number {
  const f = zonedFields(date);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Calendar day (`YYYY-MM-DD`) of an instant, in the event time zone. */
export function dayKeyOf(date: Date): string {
  const f = zonedFields(date);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}`;
}

/** Month key (`YYYY-MM`) of a day key. */
export function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/** Parses `YYYY-MM-DD` and rejects impossible dates such as 2026-02-30. */
export function parseDayKey(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const check = new Date(Date.UTC(year, month - 1, day));
  const valid =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return valid ? { year, month, day } : null;
}

/** Parses `YYYY-MM`. */
export function parseMonthKey(value: unknown): { year: number; month: number } | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return null;
  const parsed = parseDayKey(`${value}-01`);
  return parsed ? { year: parsed.year, month: parsed.month } : null;
}

/** Day key shifted by a number of days (pure calendar arithmetic, no time zone involved). */
export function addDays(dayKey: string, days: number): string {
  const parsed = parseDayKey(dayKey);
  if (!parsed) throw new Error(`Invalid day key: ${dayKey}`);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day) + days * MS_PER_DAY);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** UTC instant of a wall-clock time in the event time zone. */
export function zonedToUtc(dayKey: string, hour = 0, minute = 0): Date {
  const parsed = parseDayKey(dayKey);
  if (!parsed) throw new Error(`Invalid day key: ${dayKey}`);
  const naive = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute);
  const first = naive - zoneOffsetMs(new Date(naive));
  // Around a DST change the first guess can be off by the shift: correct it once.
  const second = naive - zoneOffsetMs(new Date(first));
  return new Date(second);
}

/** UTC bounds `[start, end)` of a whole day in the event time zone. */
export function dayRangeUtc(dayKey: string): { start: Date; end: Date } {
  return { start: zonedToUtc(dayKey), end: zonedToUtc(addDays(dayKey, 1)) };
}

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: EVENT_TIME_ZONE,
});
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: EVENT_TIME_ZONE,
});
const monthFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `14:30` in the event time zone. */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** `mercredi 7 octobre 2026` for an instant. */
export function formatDayLong(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** `mercredi 7 octobre 2026` for a day key. */
export function formatDayKeyLong(dayKey: string): string {
  return dayFormat.format(zonedToUtc(dayKey, 12));
}

/** `octobre 2026` for a month key. */
export function formatMonthLabel(monthKey: string): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  return monthFormat.format(new Date(Date.UTC(parsed.year, parsed.month - 1, 1)));
}

/** `14:30` or `14:30 – 16:00`. */
export function formatTimeRange(startIso: string, endIso: string | null): string {
  return endIso ? `${formatTime(startIso)} – ${formatTime(endIso)}` : formatTime(startIso);
}
