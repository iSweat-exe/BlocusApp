/** Time zone of the events: they are stored in UTC and shown/entered in this zone. */
export const EVENT_TIME_ZONE = "Europe/Paris";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Fields = { year: number; month: number; day: number; hour: number; minute: number };

// Built once: constructing an Intl.DateTimeFormat costs ~100 µs, and a month view needs hundreds of
// conversions (one per grid cell and per event), which used to dominate the render time.
const fieldsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function zonedFields(date: Date): Fields {
  const parts = fieldsFormat.formatToParts(date);
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

/** Weekday of a day key: Monday = 0, ..., Sunday = 6. */
export function weekdayOf(dayKey: string): number {
  const parsed = parseDayKey(dayKey);
  if (!parsed) throw new Error(`Invalid day key: ${dayKey}`);
  return (new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing the day key. */
export function mondayOf(dayKey: string): string {
  return addDays(dayKey, -weekdayOf(dayKey));
}

/** All 7 day keys (Monday to Sunday) of the week containing the day key. */
export function weekDaysOf(dayKey: string): string[] {
  const monday = mondayOf(dayKey);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** ISO week key (`YYYY-WW`) of a day key. */
export function weekKeyOf(dayKey: string): string {
  const weekday = weekdayOf(dayKey);
  const thursdayKey = addDays(dayKey, 3 - weekday);
  const thursdayParsed = parseDayKey(thursdayKey);
  if (!thursdayParsed) throw new Error(`Invalid day key: ${dayKey}`);
  const isoYear = thursdayParsed.year;

  const jan4Weekday = weekdayOf(`${isoYear}-01-04`);
  const week1MondayKey = addDays(`${isoYear}-01-04`, -jan4Weekday);

  const mondayKey = mondayOf(dayKey);
  const mondayParsed = parseDayKey(mondayKey)!;
  const week1Parsed = parseDayKey(week1MondayKey)!;
  const mondayUtc = Date.UTC(mondayParsed.year, mondayParsed.month - 1, mondayParsed.day);
  const week1Utc = Date.UTC(week1Parsed.year, week1Parsed.month - 1, week1Parsed.day);
  const diffDays = Math.round((mondayUtc - week1Utc) / MS_PER_DAY);
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `${isoYear}-${pad(weekNum)}`;
}

/** Parses `YYYY-WW` or `YYYY-Www`. */
export function parseWeekKey(value: unknown): { year: number; week: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(?:W)?(\d{1,2})$/i.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  if (week === 53) {
    const dec28Week = weekKeyOf(`${year}-12-28`);
    if (dec28Week !== `${year}-53`) return null;
  }
  return { year, week };
}

/** Resolves the Monday of a week key. */
export function dayKeyFromWeek(weekKey: string, dayOffset = 0): string | null {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return null;
  const jan4Weekday = weekdayOf(`${parsed.year}-01-04`);
  const week1MondayKey = addDays(`${parsed.year}-01-04`, -jan4Weekday);
  return addDays(week1MondayKey, (parsed.week - 1) * 7 + dayOffset);
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

/** Fractional hour (`14.5` for 14:30) of an ISO instant in Europe/Paris. */
export function timeToHour(iso: string): number {
  const f = zonedFields(new Date(iso));
  return f.hour + f.minute / 60;
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

const shortDayMonthFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: EVENT_TIME_ZONE,
});
const shortDayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  timeZone: EVENT_TIME_ZONE,
});
const shortMonthYearFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: EVENT_TIME_ZONE,
});

/** `12 – 18 oct. 2026` or `28 sept. – 4 oct. 2026` for a week. */
export function formatWeekRange(dayKey: string): string {
  const monday = mondayOf(dayKey);
  const sunday = addDays(monday, 6);
  const monParsed = parseDayKey(monday)!;
  const sunParsed = parseDayKey(sunday)!;
  const monDate = zonedToUtc(monday, 12);
  const sunDate = zonedToUtc(sunday, 12);

  if (monParsed.year !== sunParsed.year) {
    return `${shortDayMonthFormat.format(monDate)} ${monParsed.year} – ${shortDayMonthFormat.format(sunDate)} ${sunParsed.year}`;
  }
  if (monParsed.month !== sunParsed.month) {
    return `${shortDayMonthFormat.format(monDate)} – ${shortDayMonthFormat.format(sunDate)} ${sunParsed.year}`;
  }
  return `${shortDayFormat.format(monDate)} – ${shortDayFormat.format(sunDate)} ${shortMonthYearFormat.format(sunDate)}`;
}

/** `Semaine 42` for a week key. */
export function formatWeekLabel(weekKey: string): string {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return weekKey;
  return `Semaine ${parsed.week}`;
}

/**
 * Length of an event as people say it: `45 min`, `2 h`, `1 h 30`. `null` when there is no end, or when the end does
 * not come after the start.
 */
export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Whole days from one day key to another (positive when `toKey` is later). */
export function daysBetween(fromKey: string, toKey: string): number {
  const from = parseDayKey(fromKey);
  const to = parseDayKey(toKey);
  if (!from || !to) return 0;
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) /
      86_400_000,
  );
}

/**
 * Where a day stands compared to today: `Aujourd'hui`, `Demain`, `Hier`, `Dans 3 jours`, `Il y a 2 jours`. `null`
 * beyond a month either way, where the full date says it better.
 */
export function relativeDayLabel(dayKey: string, todayKey: string): string | null {
  const days = daysBetween(todayKey, dayKey);
  if (Math.abs(days) > 30) return null;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days === -1) return "Hier";
  return days > 0 ? `Dans ${days} jours` : `Il y a ${-days} jours`;
}

/** Whether an event with an end is under way at `now` (an event without an end is never "en cours"). */
export function isInProgress(startIso: string, endIso: string | null, now: number): boolean {
  if (!endIso) return false;
  return new Date(startIso).getTime() <= now && now < new Date(endIso).getTime();
}
