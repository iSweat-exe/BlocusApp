import Link from "next/link";
import { PinIcon } from "@/components/icons";
import type { DayEvent } from "./calendar-types";
import { computeEventBounds, DAY_HOUR_MARKS, DAY_RANGE, startMarkersOf } from "./timeline";
import { formatDayKeyLong } from "./time";

/**
 * Day view: the whole day (00:00 to 00:00) with an hour every 6 h on the left, the exact start of each event in that
 * strip (like the iOS Calendar), and proportional event blocks to the right, without scroll.
 */
export function DayTimeline({ day, events }: { day: string; events: DayEvent[] }) {
  const markers = startMarkersOf(events);
  return (
    <div
      tabIndex={0}
      aria-label={`Planning du ${formatDayKeyLong(day)} sur 24 heures`}
      className="relative flex-1 min-h-0 overflow-hidden rounded-control bg-foreground/5 transition-colors select-none p-2"
    >
      {/* Hours on the left, guideline lines going across to the right. An hour that an event start marker
                  would overlap is hidden, like iOS does with its current-time label. */}
      {DAY_HOUR_MARKS.map(({ hour, label, percent }) => (
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
          <span
            className={`w-11 text-xs font-medium tabular-nums text-muted text-right pr-2 shrink-0 ${
              markers.some((marker) => Math.abs(marker.hour - hour) < 0.9) ? "opacity-0" : ""
            }`}
          >
            {label}
          </span>
          <div className="flex-1 border-t border-foreground/10" />
        </div>
      ))}

      {/* Exact start of each event, in the style of the iOS Calendar: the time in the left strip with the
                  other hours (in the accent colour), a dot, and a thin line across the timeline, in addition to the
                  time printed at the top left of the event block. */}
      {markers.map(({ startTime, topPercent }) => (
        <div
          key={startTime}
          aria-hidden="true"
          data-start-marker={startTime}
          style={{ top: `${topPercent}%` }}
          className="pointer-events-none absolute inset-x-2 z-20 flex -translate-y-1/2 items-center"
        >
          <span className="w-11 shrink-0 pr-2 text-right text-xs font-semibold tabular-nums text-accent">
            {startTime}
          </span>
          <span className="-mr-px size-1.5 shrink-0 rounded-full bg-accent" />
          <div className="h-px flex-1 bg-accent" />
        </div>
      ))}

      {/* Event blocks: to the right of the hours strip (left-14) */}
      {events.map((event) => {
        const { topPercent, heightPercent } = computeEventBounds(event, DAY_RANGE);

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
            className={`absolute left-14 right-2 rounded-[calc(var(--radius-control)-0.5rem)] p-2.5 shadow-sm transition-transform [@media(hover:hover)]:hover:scale-[1.01] flex flex-col justify-between overflow-hidden z-10 ${
              event.finished
                ? "bg-foreground/20 text-foreground/60 line-through"
                : "bg-accent text-accent-ink font-semibold shadow-xs"
            }`}
          >
            {/* 1. Heure en haut */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-semibold tabular-nums opacity-90">{event.time}</span>
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

      {events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 pl-14">
          <span className="text-xs text-muted/60 italic bg-background/80 px-3 py-1.5 rounded-full border border-foreground/5 shadow-xs">
            Aucun événement prévu ce jour
          </span>
        </div>
      )}
    </div>
  );
}
