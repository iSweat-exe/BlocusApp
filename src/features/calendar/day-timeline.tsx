import { useEffect, useMemo, useRef } from "react";
import type { DayEvent } from "./calendar-types";
import { DAY_GUTTER, DayEventBlock } from "./day-event-block";
import { assignHues, EVENT_HUES, solidColor } from "./event-colors";
import { formatDayKeyLong, timeToHour } from "./time";
import {
  DAY_HEIGHT_PX,
  DAY_HOUR_PX,
  DAY_HOURS,
  DAY_MIN_HEIGHT_PERCENT,
  DAY_RANGE,
  hourToPx,
  initialScrollHour,
  LABEL_CLEARANCE_PX,
  labelledMarkers,
  layoutEvents,
} from "./timeline";
import { useMinuteClock } from "./use-minute-clock";

/** The strip on the left: a time (`w-10`) then the gap (`ml-2`) that makes up {@link DAY_GUTTER}. */
const LABEL = "w-10 shrink-0 pr-2 text-right text-[11px] tabular-nums";

/** An hour label is hidden when a start time or the current time is written at the same height. */
const clashes = (px: number, others: readonly number[]) =>
  others.some((other) => Math.abs(other - px) < LABEL_CLEARANCE_PX);

/**
 * Day view, copied from the iOS Calendar: the whole day (00:00 to 00:00) as a timeline that scrolls, an hour every
 * {@link DAY_HOUR_PX} px with its label on the left, events as tinted blocks with a bar on the left (side by side when
 * they overlap), the exact start of each event written in the left strip with a dot and a thin line, and, today, the
 * current time as a line in the accent colour. It opens an hour before the first event.
 */
export function DayTimeline({
  day,
  today,
  events,
}: {
  day: string;
  today: string;
  events: DayEvent[];
}) {
  const placed = useMemo(() => layoutEvents(events, DAY_RANGE, DAY_MIN_HEIGHT_PERCENT), [events]);
  const hues = useMemo(() => assignHues(events), [events]);
  const markers = useMemo(() => labelledMarkers(events), [events]);

  // Open on the morning of the day, like iOS: an hour before the first event.
  const scrollHour = initialScrollHour(events);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = hourToPx(scrollHour);
  }, [day, scrollHour]);

  const now = useMinuteClock();
  const nowHour = now !== null && day === today ? timeToHour(new Date(now).toISOString()) : null;
  const nowPx = nowHour === null ? null : hourToPx(nowHour);
  const nowLabel =
    now === null
      ? ""
      : new Intl.DateTimeFormat("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Paris",
        }).format(now);

  const writtenPx = [
    ...markers.filter((marker) => marker.labelled).map((marker) => marker.px),
    ...(nowPx === null ? [] : [nowPx]),
  ];

  return (
    <div
      ref={scroller}
      tabIndex={0}
      role="region"
      aria-label={`Planning du ${formatDayKeyLong(day)} sur 24 heures, à faire défiler`}
      className="relative min-h-0 flex-1 select-none overflow-y-auto overscroll-contain rounded-control bg-foreground/5 px-2"
    >
      <div className="relative my-3" style={{ height: DAY_HEIGHT_PX }}>
        {/* The hours: a label in the left strip and a thin line across. */}
        {DAY_HOURS.map(({ hour, label }) => (
          <div
            key={hour}
            aria-hidden="true"
            style={{ top: hour * DAY_HOUR_PX }}
            className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center"
          >
            <span
              className={`${LABEL} font-medium text-muted ${
                clashes(hour * DAY_HOUR_PX, writtenPx) ? "opacity-0" : ""
              }`}
            >
              {label}
            </span>
            <div className="ml-2 flex-1 border-t border-foreground/10" />
          </div>
        ))}
        {/* The midnight that ends the day: a last line, without a label. */}
        <div
          aria-hidden="true"
          style={{ top: DAY_HEIGHT_PX, marginLeft: DAY_GUTTER }}
          className="pointer-events-none absolute inset-x-0 border-t border-foreground/10"
        />

        {/* Exact start of each event: its time in the left strip, a dot, a thin line, in the colour of the event. */}
        {markers.map((marker) => {
          const color = solidColor(hues.get(marker.eventId) ?? EVENT_HUES[0]);
          return (
            <div
              key={marker.startTime}
              aria-hidden="true"
              data-start-marker={marker.startTime}
              style={{ top: marker.px, color }}
              // Under the blocks: a start line never runs through the title of another event.
              className="pointer-events-none absolute inset-x-0 z-[5] flex -translate-y-1/2 items-center"
            >
              <span className={`${LABEL} font-semibold ${marker.labelled ? "" : "opacity-0"}`}>
                {marker.startTime}
              </span>
              <span className="-mr-px size-1.5 shrink-0 rounded-full bg-current" />
              <div className="h-px flex-1 bg-current opacity-60" />
            </div>
          );
        })}

        {placed.map((item) => (
          <DayEventBlock
            key={item.event.id}
            placed={item}
            hue={hues.get(item.event.id) ?? EVENT_HUES[0]}
          />
        ))}

        {/* Today: the current time, on top of everything. */}
        {nowPx !== null && (
          <div
            aria-hidden="true"
            data-now-line
            style={{ top: nowPx }}
            className="pointer-events-none absolute inset-x-0 z-30 flex -translate-y-1/2 items-center text-accent"
          >
            <span className={`${LABEL} font-semibold`}>{nowLabel}</span>
            <span className="-mr-px size-2 shrink-0 rounded-full bg-current" />
            <div className="h-px flex-1 bg-current" />
          </div>
        )}

        {events.length === 0 && (
          <div
            data-empty-day
            style={{ top: hourToPx(scrollHour + 2), left: DAY_GUTTER }}
            className="pointer-events-none absolute right-0 z-10 flex justify-center"
          >
            <p className="rounded-full border border-foreground/5 bg-background/80 px-3 py-1.5 text-xs text-muted/70 italic shadow-xs">
              Aucun événement prévu ce jour
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
