import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView } from "@/features/calendar/calendar-view";
import { dayKeyOf, monthKeyOf, parseDayKey, parseMonthKey } from "@/features/calendar/time";

async function CalendarContent({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  // The page depends on the current time: render it at request time, not in a prerender.
  await connection();
  const params = await searchParams;
  const today = dayKeyOf(new Date());

  // Invalid or missing parameters fall back to the current month / day.
  const month = parseMonthKey(params.month) ? (params.month as string) : monthKeyOf(today);
  const requestedDay = parseDayKey(params.day) ? (params.day as string) : null;
  const day =
    requestedDay && monthKeyOf(requestedDay) === month
      ? requestedDay
      : monthKeyOf(today) === month
        ? today
        : `${month}-01`;

  return <CalendarView month={month} day={day} />;
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Calendrier</h1>
      <Suspense fallback={<p className="text-sm text-foreground/60">Chargement…</p>}>
        <CalendarContent searchParams={searchParams as Promise<{ month?: string; day?: string }>} />
      </Suspense>
    </div>
  );
}
