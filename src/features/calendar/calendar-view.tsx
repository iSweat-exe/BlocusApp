import { listEventsBetween } from "@/lib/data/events";
import { getSessionPermissions } from "@/server/session";
import type { CalendarViewMode } from "./calendar-types";
import { monthGrid } from "./month-grid";
import { MonthView, type DayEvent } from "./month-view";
import { dayKeyOf, formatTime, formatTimeRange, timeToHour, zonedToUtc } from "./time";

/**
 * Month calendar: reads the whole visible grid in one (shared, cached) query, groups the events by day
 * and hands them to the client component, which handles day selection without any further request.
 */
export async function CalendarView({
  initialView = "month",
  month,
  day,
}: {
  initialView?: CalendarViewMode;
  month: string;
  day: string;
}) {
  const weeks = monthGrid(month);
  const firstCell = weeks[0]?.[0]?.key;
  const lastCell = weeks.at(-1)?.at(-1)?.key;
  if (!firstCell || !lastCell) return null;

  // Fetch the whole visible grid (neighbouring days included), end bound is exclusive.
  const rangeEnd = new Date(zonedToUtc(lastCell).getTime() + 24 * 60 * 60 * 1000);
  const [result, session] = await Promise.all([
    listEventsBetween(zonedToUtc(firstCell), rangeEnd),
    getSessionPermissions(),
  ]);

  // Group on the server so the client receives only what it shows (no raw timestamps, no time zone work).
  const eventsByDay: Record<string, DayEvent[]> = {};
  for (const event of result.ok ? result.value : []) {
    const rawStart = timeToHour(event.starts_at);
    const hasExplicitEnd = event.ends_at !== null;
    const rawEnd = hasExplicitEnd ? timeToHour(event.ends_at!) : rawStart < 18 ? 18 : rawStart + 1;
    const startHour = Math.min(24, Math.max(6, rawStart));
    const endHour = Math.min(24, Math.max(startHour + 0.5, rawEnd));

    (eventsByDay[dayKeyOf(new Date(event.starts_at))] ??= []).push({
      id: event.id,
      title: event.title,
      location: event.location ?? "",
      time: formatTimeRange(event.starts_at, event.ends_at),
      finished: event.finished_at !== null,
      startHour,
      endHour,
      startTime: formatTime(event.starts_at),
    });
  }

  return (
    // Keyed by month: changing month remounts it, so the selected day restarts from the server's choice.
    <MonthView
      key={month}
      initialView={initialView}
      month={month}
      initialDay={day}
      today={dayKeyOf(new Date())}
      canCreateEvents={session?.permissions.includes("event.create") ?? false}
      loadFailed={!result.ok}
      eventsByDay={eventsByDay}
    />
  );
}
