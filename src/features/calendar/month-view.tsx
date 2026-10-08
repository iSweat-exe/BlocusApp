"use client";

import Link from "next/link";
import { useState } from "react";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import { EventForm } from "./event-form";
import { monthGrid, shiftMonth } from "./month-grid";
import { formatDayKeyLong, formatMonthLabel, monthKeyOf } from "./time";

/** An event of the month as the client needs it: the server has already formatted the time range. */
export type DayEvent = {
  id: string;
  title: string;
  location: string;
  time: string;
  finished: boolean;
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const href = (month: string, day?: string) =>
  day ? `/calendar?month=${month}&day=${day}` : `/calendar?month=${month}`;

/**
 * The month grid and the events of the selected day. All the month's events arrive in one payload, so
 * picking another day is instant and costs no request (it used to be a server navigation per tap): the
 * selection is client state, and the address bar is kept in sync with `history.replaceState` so the URL
 * stays shareable. Without JavaScript the days are plain links and the server renders the chosen day.
 * Changing month is still a navigation: it loads (and caches) that month's events once.
 */
export function MonthView({
  month,
  initialDay,
  today,
  canCreateEvents,
  loadFailed,
  eventsByDay,
}: {
  month: string;
  initialDay: string;
  today: string;
  /** Holds `event.create` (display only: the Server Action re-checks, the database refuses past starts). */
  canCreateEvents: boolean;
  loadFailed: boolean;
  eventsByDay: Record<string, DayEvent[]>;
}) {
  const [day, setDay] = useState(initialDay);
  const weeks = monthGrid(month);
  const selected = eventsByDay[day] ?? [];
  const canCreate = canCreateEvents && day >= today;

  const select = (key: string) => {
    setDay(key);
    window.history.replaceState(null, "", href(month, key));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={href(shiftMonth(month, -1))}
          prefetch={false}
          aria-label="Mois précédent"
          className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
        >
          ‹
        </Link>
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-semibold first-letter:uppercase">
            {formatMonthLabel(month)}
          </h2>
          {monthKeyOf(today) !== month && (
            <Link
              href={href(monthKeyOf(today), today)}
              prefetch={false}
              className="text-xs underline"
            >
              Aujourd&apos;hui
            </Link>
          )}
        </div>
        <Link
          href={href(shiftMonth(month, 1))}
          prefetch={false}
          aria-label="Mois suivant"
          className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
        >
          ›
        </Link>
      </div>

      {loadFailed && (
        <p role="alert" className="alert alert-error">
          Impossible de charger les événements pour le moment.
        </p>
      )}

      <div
        role="grid"
        aria-label={`Calendrier ${formatMonthLabel(month)}`}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7 text-center text-xs text-muted">
          {WEEKDAYS.map((name) => (
            <span key={name} role="columnheader">
              {name}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.key} role="row" className="grid grid-cols-7 gap-1">
            {week.map((cell) => {
              const dayEvents = eventsByDay[cell.key] ?? [];
              const count = dayEvents.length;
              const open = dayEvents.filter((event) => !event.finished).length;
              const isSelected = cell.key === day;
              const isToday = cell.key === today;
              return (
                // A plain link (not next/link): it is handled on the client, and it is a full page load
                // when JavaScript is unavailable.
                <a
                  key={cell.key}
                  role="gridcell"
                  href={href(month, cell.key)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    if (event.button !== 0) return;
                    event.preventDefault();
                    select(cell.key);
                  }}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${formatDayKeyLong(cell.key)}${count ? `, ${count} événement${count > 1 ? "s" : ""}` : ""}`}
                  className={`flex h-14 flex-col items-center justify-center rounded-control text-sm ${
                    isSelected
                      ? "bg-accent text-accent-ink"
                      : isToday
                        ? "border border-accent"
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
                            ? "bg-accent"
                            : "bg-foreground/40"
                        : "bg-transparent"
                    }`}
                  />
                </a>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-labelledby="day-title" className="flex flex-col gap-2">
        <h3 id="day-title" className="font-semibold first-letter:uppercase">
          {formatDayKeyLong(day)}
        </h3>
        {selected.length === 0 ? (
          <p className="text-sm text-muted">Aucun événement ce jour-là.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selected.map((event) => (
              <li key={event.id}>
                {/* prefetch={false}: a list of links must not trigger one prefetch request per row. */}
                <Link
                  href={`/calendar/${event.id}`}
                  prefetch={false}
                  aria-disabled={event.finished ? true : undefined}
                  className={`card-link flex flex-col p-4 ${
                    event.finished ? "bg-foreground/5 opacity-60" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${event.finished ? "" : "text-accent"}`}>
                      {event.time}
                    </span>
                    {event.finished && (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold">
                        Terminé
                      </span>
                    )}
                  </span>
                  <span className={`font-semibold ${event.finished ? "line-through" : ""}`}>
                    {event.title}
                  </span>
                  {event.location && <span className="text-sm text-muted">{event.location}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCreate && (
        <FullScreenDialog triggerLabel="Ajouter un événement" title="Nouvel événement">
          <EventForm mode="create" day={day} />
        </FullScreenDialog>
      )}
    </div>
  );
}
