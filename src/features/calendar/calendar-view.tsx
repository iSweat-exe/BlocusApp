import Link from "next/link";
import { listEventsBetween } from "@/lib/data/events";
import { getSessionPermissions } from "@/server/session";
import { EventForm } from "./event-form";
import { monthGrid, shiftMonth } from "./month-grid";
import {
  dayKeyOf,
  formatDayKeyLong,
  formatMonthLabel,
  formatTimeRange,
  monthKeyOf,
  zonedToUtc,
} from "./time";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const href = (month: string, day?: string) =>
  day ? `/calendar?month=${month}&day=${day}` : `/calendar?month=${month}`;

/** Month grid with a marker on days that have events, and the events of the selected day below. */
export async function CalendarView({ month, day }: { month: string; day: string }) {
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

  const today = dayKeyOf(new Date());
  const events = result.ok ? result.value : [];
  const byDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = dayKeyOf(new Date(event.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  const selected = byDay.get(day) ?? [];
  // Display only: the Server Action re-checks the permission, and the database refuses past starts.
  const canCreate = (session?.permissions.includes("event.create") ?? false) && day >= today;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={href(shiftMonth(month, -1))}
          aria-label="Mois précédent"
          className="px-3 py-2 text-lg"
        >
          ‹
        </Link>
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-semibold capitalize">{formatMonthLabel(month)}</h2>
          {monthKeyOf(today) !== month && (
            <Link href={href(monthKeyOf(today), today)} className="text-xs underline">
              Aujourd&apos;hui
            </Link>
          )}
        </div>
        <Link
          href={href(shiftMonth(month, 1))}
          aria-label="Mois suivant"
          className="px-3 py-2 text-lg"
        >
          ›
        </Link>
      </div>

      {!result.ok && (
        <p role="alert" className="text-sm text-red-500">
          Impossible de charger les événements pour le moment.
        </p>
      )}

      <div
        role="grid"
        aria-label={`Calendrier ${formatMonthLabel(month)}`}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7 text-center text-xs text-foreground/60">
          {WEEKDAYS.map((name) => (
            <span key={name} role="columnheader">
              {name}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.key} role="row" className="grid grid-cols-7 gap-1">
            {week.map((cell) => {
              const dayEvents = byDay.get(cell.key) ?? [];
              const count = dayEvents.length;
              const open = dayEvents.filter((event) => !event.finished_at).length;
              const isSelected = cell.key === day;
              const isToday = cell.key === today;
              return (
                <Link
                  key={cell.key}
                  role="gridcell"
                  href={href(month, cell.key)}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${formatDayKeyLong(cell.key)}${count ? `, ${count} événement${count > 1 ? "s" : ""}` : ""}`}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg text-sm ${
                    isSelected
                      ? "bg-red-500 text-white"
                      : isToday
                        ? "border border-red-500"
                        : "bg-foreground/5"
                  } ${cell.inMonth ? "" : "opacity-40"}`}
                >
                  <span>{cell.day}</span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      count
                        ? isSelected
                          ? "bg-white"
                          : open > 0
                            ? "bg-red-500"
                            : "bg-foreground/40"
                        : "bg-transparent"
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-labelledby="day-title" className="flex flex-col gap-2">
        <h3 id="day-title" className="font-semibold capitalize">
          {formatDayKeyLong(day)}
        </h3>
        {selected.length === 0 ? (
          <p className="text-sm text-foreground/60">Aucun événement ce jour-là.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selected.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/calendar/${event.id}`}
                  aria-disabled={event.finished_at ? true : undefined}
                  className={`flex flex-col rounded-lg border border-foreground/10 p-3 ${
                    event.finished_at ? "bg-foreground/5 opacity-60" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-medium ${event.finished_at ? "" : "text-red-500"}`}
                    >
                      {formatTimeRange(event.starts_at, event.ends_at)}
                    </span>
                    {event.finished_at && (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold">
                        Terminé
                      </span>
                    )}
                  </span>
                  <span className={`font-semibold ${event.finished_at ? "line-through" : ""}`}>
                    {event.title}
                  </span>
                  {event.location && (
                    <span className="text-sm text-foreground/60">{event.location}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCreate && (
        <details className="rounded-lg border border-foreground/10">
          <summary className="cursor-pointer rounded-lg bg-red-500 px-4 py-3 text-center font-medium text-white">
            Ajouter un événement
          </summary>
          <EventForm mode="create" day={day} />
        </details>
      )}
    </div>
  );
}
