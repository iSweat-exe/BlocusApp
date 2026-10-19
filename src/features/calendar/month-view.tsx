"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import { CalendarIcon, PinIcon } from "@/components/icons";
import { buildCalendarHref, type CalendarViewMode, type DayEvent } from "./calendar-types";
import { DayTimeline } from "./day-timeline";
import { EventForm } from "./event-form";
import { monthGrid, shiftMonth } from "./month-grid";
import {
  addDays,
  formatDayKeyLong,
  formatMonthLabel,
  formatWeekLabel,
  formatWeekRange,
  monthKeyOf,
  weekKeyOf,
} from "./time";
import { usePinchZoom } from "./use-pinch-zoom";
import { ViewSwitcher } from "./view-switcher";
import { WeekView } from "./week-view";

// The timeline maths and the event type moved out of this file; they stay importable from here.
export { computeEventBounds, startMarkersOf } from "./timeline";
export type { DayEvent } from "./calendar-types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const VIEW_RANK: Record<CalendarViewMode, number> = {
  month: 1,
  week: 2,
  day: 3,
};

/**
 * Calendar view with Month, Week, and Day modes.
 * - Week view displays 7 vertical bars (columns) with proportional event blocks (6h - 24h, no scroll).
 * - Day view displays the whole day (00:00 to 00:00) with the hours every 6 h on the left, the exact start of each event
 *   in the left strip (like the iOS Calendar) and proportional event blocks, without scroll.
 * - Navigation slides smoothly left or right only on prev/next button clicks.
 * - Zoom in/out animation transitions smoothly between modes.
 * - Month view keeps days compactly grouped without large holes.
 * - Fixed height container guarantees zero layout shift.
 */
export function MonthView({
  initialView = "month",
  month,
  initialDay,
  today,
  canCreateEvents,
  loadFailed,
  eventsByDay,
}: {
  initialView?: CalendarViewMode;
  month: string;
  initialDay: string;
  today: string;
  canCreateEvents: boolean;
  loadFailed: boolean;
  eventsByDay: Record<string, DayEvent[]>;
}) {
  const [view, setView] = useState<CalendarViewMode>(initialView);
  const [day, setDay] = useState(initialDay);
  const [anim, setAnim] = useState({ className: "animate-fade-in", key: 0 });

  const weeks = monthGrid(month);
  const selected = eventsByDay[day] ?? [];
  const canCreate = canCreateEvents && day >= today;

  // Plays an animation on the calendar area: a new key restarts it, whatever the previous class was.
  const play = (className: string) => setAnim((previous) => ({ className, key: previous.key + 1 }));

  // Selects a day on the client (no navigation) and keeps the URL shareable.
  const select = (key: string) => {
    setDay(key);
    window.history.replaceState(
      null,
      "",
      buildCalendarHref({
        view,
        day: key,
        month: monthKeyOf(key),
        week: weekKeyOf(key),
      }),
    );
  };

  const changeView = useCallback(
    (newView: CalendarViewMode) => {
      if (newView === view) return;
      const isZoomIn = VIEW_RANK[newView] > VIEW_RANK[view];
      setAnim((previous) => ({
        className: isZoomIn ? "animate-zoom-in" : "animate-zoom-out",
        key: previous.key + 1,
      }));
      setView(newView);
      window.history.replaceState(
        null,
        "",
        buildCalendarHref({ view: newView, day, month, week: weekKeyOf(day) }),
      );
    },
    [view, day, month],
  );

  // Previous / next with a slide, only inside the month shown (otherwise the link loads the other month).
  const slideTo = (targetDay: string, className: "animate-slide-left" | "animate-slide-right") => {
    if (monthKeyOf(targetDay) !== month) return;
    play(className);
    select(targetDay);
  };
  const navigatePrev = (targetDay: string) => slideTo(targetDay, "animate-slide-right");
  const navigateNext = (targetDay: string) => slideTo(targetDay, "animate-slide-left");

  // Pinch zoom (2 fingers on touch screens, or trackpad pinch) moves between the views.
  const { containerRef, touchHandlers } = usePinchZoom(view, changeView);

  return (
    <div className="flex flex-col gap-4">
      {/* Title row with page heading and view switcher */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Calendrier</h1>
        <ViewSwitcher currentView={view} onChangeView={changeView} />
      </div>

      {loadFailed && (
        <p role="alert" className="alert alert-error">
          Impossible de charger les événements pour le moment.
        </p>
      )}

      {/* Fixed-height calendar container to prevent layout shifts across view modes */}
      <div
        ref={containerRef}
        {...touchHandlers}
        className="flex h-[396px] flex-col gap-3 overflow-hidden select-none touch-pan-x touch-pan-y"
      >
        {/* Navigation bar depending on active view mode */}
        {view === "month" && (
          <div className="flex items-center justify-between">
            <Link
              href={buildCalendarHref({
                view: "month",
                day: `${shiftMonth(month, -1)}-01`,
                month: shiftMonth(month, -1),
              })}
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
                  href={buildCalendarHref({ view: "month", day: today, month: monthKeyOf(today) })}
                  prefetch={false}
                  className="relative text-xs underline after:absolute after:-inset-x-3 after:-inset-y-3.5 after:content-['']"
                >
                  Aujourd&apos;hui
                </Link>
              )}
            </div>
            <Link
              href={buildCalendarHref({
                view: "month",
                day: `${shiftMonth(month, 1)}-01`,
                month: shiftMonth(month, 1),
              })}
              prefetch={false}
              aria-label="Mois suivant"
              className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
            >
              ›
            </Link>
          </div>
        )}

        {view === "week" && (
          <div className="flex items-center justify-between">
            <Link
              href={buildCalendarHref({
                view: "week",
                day: addDays(day, -7),
                week: weekKeyOf(addDays(day, -7)),
              })}
              prefetch={false}
              aria-label="Semaine précédente"
              onClick={(e) => {
                const target = addDays(day, -7);
                if (monthKeyOf(target) === month) {
                  e.preventDefault();
                  navigatePrev(target);
                }
              }}
              className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
            >
              ‹
            </Link>
            <div className="flex flex-col items-center">
              <h2 className="text-lg font-semibold">{formatWeekLabel(weekKeyOf(day))}</h2>
              <span className="text-xs text-muted">{formatWeekRange(day)}</span>
              {weekKeyOf(today) !== weekKeyOf(day) && (
                <Link
                  href={buildCalendarHref({ view: "week", day: today, week: weekKeyOf(today) })}
                  prefetch={false}
                  onClick={(e) => {
                    if (monthKeyOf(today) === month) {
                      e.preventDefault();
                      select(today);
                    }
                  }}
                  className="relative mt-0.5 text-xs underline after:absolute after:-inset-x-3 after:-inset-y-3 after:content-['']"
                >
                  Cette semaine
                </Link>
              )}
            </div>
            <Link
              href={buildCalendarHref({
                view: "week",
                day: addDays(day, 7),
                week: weekKeyOf(addDays(day, 7)),
              })}
              prefetch={false}
              aria-label="Semaine suivante"
              onClick={(e) => {
                const target = addDays(day, 7);
                if (monthKeyOf(target) === month) {
                  e.preventDefault();
                  navigateNext(target);
                }
              }}
              className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
            >
              ›
            </Link>
          </div>
        )}

        {view === "day" && (
          <div className="flex items-center justify-between">
            <Link
              href={buildCalendarHref({ view: "day", day: addDays(day, -1) })}
              prefetch={false}
              aria-label="Jour précédent"
              onClick={(e) => {
                const target = addDays(day, -1);
                if (monthKeyOf(target) === month) {
                  e.preventDefault();
                  navigatePrev(target);
                }
              }}
              className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
            >
              ‹
            </Link>
            <div className="flex flex-col items-center text-center">
              <h2 className="text-lg font-semibold first-letter:uppercase">
                {formatDayKeyLong(day)}
              </h2>
              {day !== today && (
                <Link
                  href={buildCalendarHref({ view: "day", day: today })}
                  prefetch={false}
                  onClick={(e) => {
                    if (monthKeyOf(today) === month) {
                      e.preventDefault();
                      select(today);
                    }
                  }}
                  className="relative mt-0.5 text-xs underline after:absolute after:-inset-x-3 after:-inset-y-3 after:content-['']"
                >
                  Aujourd&apos;hui
                </Link>
              )}
            </div>
            <Link
              href={buildCalendarHref({ view: "day", day: addDays(day, 1) })}
              prefetch={false}
              aria-label="Jour suivant"
              onClick={(e) => {
                const target = addDays(day, 1);
                if (monthKeyOf(target) === month) {
                  e.preventDefault();
                  navigateNext(target);
                }
              }}
              className="flex h-tap w-tap items-center justify-center rounded-full text-xl active:bg-foreground/10"
            >
              ›
            </Link>
          </div>
        )}

        {/* Animated View body container */}
        <div key={anim.key} className={`flex min-h-0 flex-1 flex-col ${anim.className}`}>
          {/* Month view: evenly distributed weeks stretching down to the bottom of the container */}
          {view === "month" && (
            <div
              role="grid"
              aria-label={`Calendrier ${formatMonthLabel(month)}`}
              className="flex flex-1 min-h-0 flex-col gap-1.5"
            >
              <div
                role="row"
                className="grid grid-cols-7 gap-1 text-center text-xs text-muted shrink-0"
              >
                {WEEKDAYS.map((name) => (
                  <span key={name} role="columnheader">
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex flex-1 min-h-0 flex-col gap-1">
                {weeks.map((week) => (
                  <div
                    key={week[0]?.key}
                    role="row"
                    className="grid grid-cols-7 gap-1 flex-1 min-h-0"
                  >
                    {week.map((cell) => {
                      const dayEvents = eventsByDay[cell.key] ?? [];
                      const count = dayEvents.length;
                      const open = dayEvents.filter((event) => !event.finished).length;
                      const isSelected = cell.key === day;
                      const isToday = cell.key === today;
                      return (
                        <a
                          key={cell.key}
                          role="gridcell"
                          href={buildCalendarHref({ view: "month", day: cell.key, month })}
                          onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                              return;
                            if (event.button !== 0) return;
                            event.preventDefault();
                            select(cell.key);
                          }}
                          aria-selected={isSelected}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={`${formatDayKeyLong(cell.key)}${count ? `, ${count} événement${count > 1 ? "s" : ""}` : ""}`}
                          className={`flex h-full min-h-0 flex-col items-center justify-center rounded-control text-sm transition-colors ${
                            isSelected
                              ? "bg-accent text-accent-ink"
                              : isToday
                                ? "border border-accent"
                                : "bg-foreground/5 [@media(hover:hover)]:hover:bg-foreground/10"
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
            </div>
          )}

          {view === "week" && (
            <WeekView day={day} today={today} eventsByDay={eventsByDay} onSelect={select} />
          )}

          {view === "day" && <DayTimeline day={day} events={selected} />}
        </div>
      </div>

      {/* Selected day events section */}
      <section aria-labelledby="day-title" className="flex flex-col gap-2">
        <h3 id="day-title" className="font-semibold first-letter:uppercase">
          {formatDayKeyLong(day)}
        </h3>
        {selected.length === 0 ? (
          <EmptyState compact icon={<CalendarIcon className="size-5" />} title="Journée tranquille">
            Rien de prévu ce jour-là.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {selected.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/calendar/${event.id}`}
                  prefetch={false}
                  aria-disabled={event.finished ? true : undefined}
                  className={`card-link flex flex-col p-4 ${
                    event.finished ? "bg-foreground/5 opacity-60" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-medium tabular-nums ${event.finished ? "" : "text-accent"}`}
                    >
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
                  {event.location && (
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      <PinIcon className="size-3.5 shrink-0" />
                      <span>{event.location}</span>
                    </span>
                  )}
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
