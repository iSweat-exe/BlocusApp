import { addDays, dayKeyOf, EVENT_TIME_ZONE, formatTime } from "@/features/calendar/time";

/**
 * Friendly publication date, in the event time zone: "Aujourd'hui, 19:35", "Hier, 15:11", "7 oct., 09:00",
 * and the year only when it is not the current one ("7 oct. 2025, 09:00").
 */
export function formatAnnouncementDate(createdAtIso: string, now: Date): string {
  const created = new Date(createdAtIso);
  const day = dayKeyOf(created);
  const today = dayKeyOf(now);
  const time = formatTime(createdAtIso);

  if (day === today) return `Aujourd'hui, ${time}`;
  if (day === addDays(today, -1)) return `Hier, ${time}`;

  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: EVENT_TIME_ZONE,
  }).format(created);
  return `${date}, ${time}`;
}
