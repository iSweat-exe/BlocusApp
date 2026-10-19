import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { resolveCalendarViewMode } from "@/features/calendar/calendar-types";
import { CalendarView } from "@/features/calendar/calendar-view";
import {
  dayKeyFromWeek,
  dayKeyOf,
  monthKeyOf,
  parseDayKey,
  parseMonthKey,
  parseWeekKey,
} from "@/features/calendar/time";

export const metadata: Metadata = { title: "Calendrier" };

export async function CalendarContent({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; week?: string; day?: string }>;
}) {
  // The page depends on the current time: render it at request time, not in a prerender.
  await connection();
  const params = await searchParams;
  const today = dayKeyOf(new Date());

  const view = resolveCalendarViewMode(params);

  let requestedDay: string | null = null;
  if (parseDayKey(params.day)) {
    requestedDay = params.day as string;
  } else if (params.week && parseWeekKey(params.week)) {
    requestedDay = dayKeyFromWeek(params.week);
  }

  // Invalid or missing parameters fall back to the current month / day.
  const month = parseMonthKey(params.month)
    ? (params.month as string)
    : requestedDay
      ? monthKeyOf(requestedDay)
      : monthKeyOf(today);

  const day =
    requestedDay && monthKeyOf(requestedDay) === month
      ? requestedDay
      : monthKeyOf(today) === month
        ? today
        : `${month}-01`;

  return <CalendarView initialView={view} month={month} day={day} />;
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <div className="flex flex-col gap-section">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="page-title">Calendrier</h1>
              <div className="h-tap w-tap rounded-control bg-foreground/5 animate-pulse" />
            </div>
            <p className="text-sm text-muted">Chargement…</p>
          </div>
        }
      >
        <CalendarContent
          searchParams={
            searchParams as Promise<{ view?: string; month?: string; week?: string; day?: string }>
          }
        />
      </Suspense>
    </div>
  );
}
