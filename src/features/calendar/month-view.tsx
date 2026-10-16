"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import { CalendarIcon, PinIcon } from "@/components/icons";
import { buildCalendarHref, type CalendarViewMode } from "./calendar-types";
import { EventForm } from "./event-form";
import { monthGrid, shiftMonth } from "./month-grid";
import {
  addDays,
  formatDayKeyLong,
  formatMonthLabel,
  formatWeekLabel,
  formatWeekRange,
  monthKeyOf,
  weekDaysOf,
  weekKeyOf,
} from "./time";
import { ViewSwitcher } from "./view-switcher";

/** An event of the month as the client needs it: the server has already formatted the time range. */
export type DayEvent = {
  id: string;
  title: string;
  location: string;
  time: string;
  finished: boolean;
  startHour?: number;
  endHour?: number;
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Time span from 6h to 24h (18 hours total, without 00h-06h). */
const TIMELINE_MIN_HOUR = 6;
const TIMELINE_MAX_HOUR = 24;
const TIMELINE_SPAN_HOURS = TIMELINE_MAX_HOUR - TIMELINE_MIN_HOUR; // 18
const DEFAULT_START_HOUR = 7.5; // 7h30 par défaut si non renseigné
const DEFAULT_END_HOUR = 18; // 18h00 par défaut si non renseigné

export function computeEventBounds(event: DayEvent): {
  topPercent: number;
  heightPercent: number;
} {
  const hasExplicitStart = event.startHour != null;
  const rawStart = hasExplicitStart ? event.startHour! : DEFAULT_START_HOUR;

  const hasExplicitEnd = event.endHour != null;
  let rawEnd: number;
  if (hasExplicitEnd) {
    rawEnd = event.endHour!;
  } else if (hasExplicitStart) {
    rawEnd =
      rawStart < DEFAULT_END_HOUR ? DEFAULT_END_HOUR : Math.min(TIMELINE_MAX_HOUR, rawStart + 1);
  } else {
    rawEnd = DEFAULT_END_HOUR;
  }

  const start = Math.max(TIMELINE_MIN_HOUR, Math.min(TIMELINE_MAX_HOUR, rawStart));
  const end = Math.max(start + 0.5, Math.min(TIMELINE_MAX_HOUR, rawEnd));

  const topPercent = Math.max(
    0,
    Math.min(92, ((start - TIMELINE_MIN_HOUR) / TIMELINE_SPAN_HOURS) * 100),
  );
  const heightPercent = Math.max(
    8,
    Math.min(100 - topPercent, ((end - start) / TIMELINE_SPAN_HOURS) * 100),
  );

  return { topPercent, heightPercent };
}

const KEY_HOURS = [
  { hour: 6, label: "06:00", percent: 0 },
  { hour: 12, label: "12:00", percent: ((12 - TIMELINE_MIN_HOUR) / TIMELINE_SPAN_HOURS) * 100 },
  { hour: 18, label: "18:00", percent: ((18 - TIMELINE_MIN_HOUR) / TIMELINE_SPAN_HOURS) * 100 },
  { hour: 24, label: "24:00", percent: 100 },
];

const VIEW_RANK: Record<CalendarViewMode, number> = {
  month: 1,
  week: 2,
  day: 3,
};

/**
 * Calendar view with Month, Week, and Day modes.
 * - Week view displays 7 vertical bars (columns) with proportional event blocks (6h - 24h, no scroll).
 * - Day view displays the day with markers at 6h, 12h, 18h, 24h and proportional event blocks without scroll.
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
  const [animClass, setAnimClass] = useState<string>("animate-fade-in");
  const [animKey, setAnimKey] = useState<number>(0);

  const weeks = monthGrid(month);
  const selected = eventsByDay[day] ?? [];
  const canCreate = canCreateEvents && day >= today;

  // Day selection within current view: pure client state update without jarring grid slide
  const select = (key: string) => {
    setDay(key);
    const newHref = buildCalendarHref({
      view,
      day: key,
      month: monthKeyOf(key),
      week: weekKeyOf(key),
    });
    window.history.replaceState(null, "", newHref);
  };

  const changeView = useCallback(
    (newView: CalendarViewMode) => {
      if (newView === view) return;
      const isZoomIn = VIEW_RANK[newView] > VIEW_RANK[view];
      setAnimClass(isZoomIn ? "animate-zoom-in" : "animate-zoom-out");
      setAnimKey((k) => k + 1);
      setView(newView);
      const newHref = buildCalendarHref({
        view: newView,
        day,
        month,
        week: weekKeyOf(day),
      });
      window.history.replaceState(null, "", newHref);
    },
    [view, day, month],
  );

  const navigatePrev = (targetDay: string) => {
    if (monthKeyOf(targetDay) === month) {
      setAnimClass("animate-slide-right");
      setAnimKey((k) => k + 1);
      setDay(targetDay);
      const newHref = buildCalendarHref({
        view,
        day: targetDay,
        month: monthKeyOf(targetDay),
        week: weekKeyOf(targetDay),
      });
      window.history.replaceState(null, "", newHref);
    }
  };

  const navigateNext = (targetDay: string) => {
    if (monthKeyOf(targetDay) === month) {
      setAnimClass("animate-slide-left");
      setAnimKey((k) => k + 1);
      setDay(targetDay);
      const newHref = buildCalendarHref({
        view,
        day: targetDay,
        month: monthKeyOf(targetDay),
        week: weekKeyOf(targetDay),
      });
      window.history.replaceState(null, "", newHref);
    }
  };

  // Pinch zoom gestures (2 fingers on touch screens, or trackpad pinch)
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);
  const gestureHandledRef = useRef(false);
  const wheelCooldownRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      touchDistanceRef.current = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      gestureHandledRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null && !gestureHandledRef.current) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const delta = currentDist - touchDistanceRef.current;

      // Pinch out (spread fingers = zoom in: month -> week -> day)
      if (delta > 35) {
        gestureHandledRef.current = true;
        if (view === "month") changeView("week");
        else if (view === "week") changeView("day");
      }
      // Pinch in (pinch fingers = zoom out / dezoom: day -> week -> month)
      else if (delta < -35) {
        gestureHandledRef.current = true;
        if (view === "day") changeView("week");
        else if (view === "week") changeView("month");
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    gestureHandledRef.current = false;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (wheelCooldownRef.current) return;

      if (e.deltaY < -15) {
        // Trackpad pinch-out = zoom in
        wheelCooldownRef.current = true;
        if (view === "month") changeView("week");
        else if (view === "week") changeView("day");
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 350);
      } else if (e.deltaY > 15) {
        // Trackpad pinch-in = zoom out / dezoom
        wheelCooldownRef.current = true;
        if (view === "day") changeView("week");
        else if (view === "week") changeView("month");
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 350);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [view, changeView]);

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
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
                  className="text-xs underline"
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
                  className="mt-0.5 text-xs underline"
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
                  className="mt-0.5 text-xs underline"
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
        <div key={animKey} className={`flex min-h-0 flex-1 flex-col ${animClass}`}>
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
                                : "bg-foreground/5 hover:bg-foreground/10"
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

          {/* Week view: 7 vertical bars (bâtons verticaux) spanning 6h-24h without scroll */}
          {view === "week" && (
            <div
              role="grid"
              aria-label="Jours de la semaine"
              className="grid flex-1 grid-cols-7 gap-1.5 min-h-0 pt-1 pb-1"
            >
              {weekDaysOf(day).map((cellKey) => {
                const dayEvents = eventsByDay[cellKey] ?? [];
                const isSelected = cellKey === day;
                const isToday = cellKey === today;
                const cellDayNum = Number(cellKey.slice(8, 10));
                const weekdayIndex = (new Date(cellKey).getUTCDay() + 6) % 7;
                const weekdayName = WEEKDAYS[weekdayIndex] ?? "";

                return (
                  <div
                    key={cellKey}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${formatDayKeyLong(cellKey)}${dayEvents.length ? `, ${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}` : ""}`}
                    onClick={() => select(cellKey)}
                    className="flex flex-col gap-1 min-h-0 cursor-pointer select-none"
                  >
                    {/* Column day header button */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        select(cellKey);
                      }}
                      className={`flex flex-col items-center justify-center rounded-control py-1 transition-colors ${
                        isSelected
                          ? "bg-accent text-accent-ink shadow-xs"
                          : isToday
                            ? "border border-accent text-foreground"
                            : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-semibold text-muted">
                        {weekdayName}
                      </span>
                      <span className="text-xs font-bold leading-none mt-0.5">{cellDayNum}</span>
                    </button>

                    {/* Vertical bar (bâton vertical sans traits) */}
                    <div
                      className={`relative flex-1 min-h-0 rounded-control transition-colors overflow-hidden ${
                        isSelected
                          ? "bg-foreground/10 ring-1 ring-accent/30"
                          : "bg-foreground/5 hover:bg-foreground/8"
                      }`}
                    >
                      {dayEvents.map((event) => {
                        const { topPercent, heightPercent } = computeEventBounds(event);

                        return (
                          <Link
                            key={event.id}
                            href={`/calendar/${event.id}`}
                            prefetch={false}
                            onClick={(e) => e.stopPropagation()}
                            title={`${event.time} — ${event.title}${event.location ? ` (${event.location})` : ""}`}
                            aria-label={`${event.time} ${event.title}`}
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                            }}
                            className={`absolute inset-x-0.5 rounded-sm p-1 text-[10px] leading-tight overflow-hidden transition-transform hover:scale-105 z-10 flex flex-col justify-between ${
                              event.finished
                                ? "bg-foreground/20 text-foreground/60 line-through"
                                : "bg-accent text-accent-ink font-semibold shadow-xs"
                            }`}
                          >
                            {/* 1. Heure en haut */}
                            <span className="block text-[9px] font-semibold opacity-90 shrink-0 leading-none">
                              {event.time}
                            </span>

                            {/* 2. Nom au milieu */}
                            <span className="block break-words line-clamp-3 leading-tight hyphens-auto font-medium my-auto">
                              {event.title}
                            </span>

                            {/* 3. Lieu en bas (sans ... si place) */}
                            {event.location ? (
                              <span className="flex items-start gap-0.5 text-[9px] opacity-90 break-words line-clamp-2 leading-tight mt-0.5 shrink-0">
                                <PinIcon className="size-2 shrink-0 mt-0.5 inline" />
                                <span className="break-words line-clamp-2">{event.location}</span>
                              </span>
                            ) : (
                              <span />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Day view: left invisible hour strip, event blocks positioned to the right */}
          {view === "day" && (
            <div
              tabIndex={0}
              aria-label={`Planning du ${formatDayKeyLong(day)} de 6h à 24h`}
              className="relative flex-1 min-h-0 overflow-hidden rounded-control bg-foreground/5 transition-colors select-none p-2"
            >
              {/* Hours on the left in an invisible strip, guideline lines going across to the right */}
              {KEY_HOURS.map(({ hour, label, percent }) => (
                <div
                  key={hour}
                  style={{ top: `${percent}%` }}
                  className={`absolute inset-x-2 flex items-center pointer-events-none z-0 ${
                    percent === 0
                      ? "translate-y-0"
                      : percent === 100
                        ? "-translate-y-full"
                        : "-translate-y-1/2"
                  }`}
                >
                  <span className="w-11 text-xs font-medium text-muted text-right pr-2 shrink-0">
                    {label}
                  </span>
                  <div className="flex-1 border-t border-foreground/10" />
                </div>
              ))}

              {/* Event blocks: positioned to the right of the invisible hours strip (left-14 right-2) */}
              {selected.map((event) => {
                const { topPercent, heightPercent } = computeEventBounds(event);

                return (
                  <Link
                    key={event.id}
                    href={`/calendar/${event.id}`}
                    prefetch={false}
                    title={`${event.time} — ${event.title}${event.location ? ` (${event.location})` : ""}`}
                    aria-label={`${event.time} ${event.title}`}
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                    }}
                    className={`absolute left-14 right-2 rounded-control p-2.5 shadow-sm transition-transform hover:scale-[1.01] flex flex-col justify-between overflow-hidden z-10 ${
                      event.finished
                        ? "bg-foreground/20 text-foreground/60 line-through"
                        : "bg-accent text-accent-ink font-semibold shadow-xs"
                    }`}
                  >
                    {/* 1. Heure en haut */}
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <span className="text-xs font-semibold opacity-90">{event.time}</span>
                      {event.finished && (
                        <span className="rounded-full bg-foreground/20 px-1.5 py-0.5 text-[10px] font-semibold">
                          Terminé
                        </span>
                      )}
                    </div>

                    {/* 2. Nom au milieu */}
                    <span className="font-bold text-sm break-words line-clamp-3 leading-snug my-auto">
                      {event.title}
                    </span>

                    {/* 3. Lieu en bas (sans ... s'il y a la place) */}
                    {event.location ? (
                      <div className="flex items-start gap-1.5 text-xs opacity-90 break-words line-clamp-2 leading-tight shrink-0">
                        <PinIcon className="size-3.5 shrink-0 mt-0.5" />
                        <span className="break-words line-clamp-2">{event.location}</span>
                      </div>
                    ) : (
                      <span />
                    )}
                  </Link>
                );
              })}

              {selected.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 pl-14">
                  <span className="text-xs text-muted/60 italic bg-background/80 px-3 py-1.5 rounded-full border border-foreground/5 shadow-xs">
                    Aucun événement prévu ce jour
                  </span>
                </div>
              )}
            </div>
          )}
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
