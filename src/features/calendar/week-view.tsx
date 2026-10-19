import Link from "next/link";
import { useMemo } from "react";
import type { DayEvent } from "./calendar-types";
import { assignHues, blockStyle, EVENT_HUES } from "./event-colors";
import { formatDayKeyLong, weekDaysOf } from "./time";
import { layoutEvents, WEEK_MIN_HEIGHT_PERCENT, WEEK_RANGE, type PlacedEvent } from "./timeline";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Space around the blocks inside a column, in px. */
const INSET_PX = 2;

/** A block is tall enough for its start time from this height (percent of the column). */
const TIME_FROM_PERCENT = 14;

/**
 * One event in a day column of the week view: a small tinted block with a bar on the left, in the colour of the
 * event. Blocks that overlap sit side by side; when they share the narrow column there is no room for text, so the
 * block is only a coloured sliver (the title is in its tooltip and its accessible name, and the day view has the rest).
 */
function WeekEventBlock({ placed, hue }: { placed: PlacedEvent; hue: number }) {
  const { event, topPercent, heightPercent, column, columns } = placed;
  const free = `(100% - ${INSET_PX * 2}px)`;
  const showText = columns === 1;

  return (
    <Link
      href={`/calendar/${event.id}`}
      prefetch={false}
      onClick={(e) => e.stopPropagation()}
      title={`${event.time} — ${event.title}${event.location ? ` (${event.location})` : ""}`}
      aria-label={`${event.time} ${event.title}`}
      data-column={column}
      data-columns={columns}
      style={{
        top: `${topPercent}%`,
        height: `calc(${heightPercent}% - 1px)`,
        left: `calc(${INSET_PX}px + ${free} * ${column} / ${columns})`,
        width: `calc(${free} / ${columns} - 1px)`,
        ...blockStyle(hue, event.finished, 2),
      }}
      className="absolute z-10 flex flex-col gap-px overflow-hidden rounded-[calc(var(--radius-control)-0.125rem)] px-1 py-0.5 text-[10px] leading-tight transition-[filter] [@media(hover:hover)]:hover:brightness-95 active:brightness-95"
    >
      {showText && (
        <>
          {heightPercent >= TIME_FROM_PERCENT && (
            <span className="text-[9px] tabular-nums opacity-80">
              {event.startTime ?? event.time}
            </span>
          )}
          <span
            className={`line-clamp-3 font-semibold break-words hyphens-auto ${
              event.finished ? "line-through" : ""
            }`}
          >
            {event.title}
          </span>
        </>
      )}
    </Link>
  );
}

/** The events of one day, laid out so that none covers another. */
function WeekColumnEvents({ events }: { events: DayEvent[] }) {
  const placed = useMemo(() => layoutEvents(events, WEEK_RANGE, WEEK_MIN_HEIGHT_PERCENT), [events]);
  const hues = useMemo(() => assignHues(events), [events]);
  return placed.map((item) => (
    <WeekEventBlock
      key={item.event.id}
      placed={item}
      hue={hues.get(item.event.id) ?? EVENT_HUES[0]}
    />
  ));
}

const NO_EVENTS: DayEvent[] = [];

/**
 * Week view: 7 vertical bars (one per day) spanning 6h-24h without scroll, with proportional, coloured event blocks.
 * Tapping a column selects its day (`onSelect`).
 */
export function WeekView({
  day,
  today,
  eventsByDay,
  onSelect,
}: {
  day: string;
  today: string;
  eventsByDay: Record<string, DayEvent[]>;
  onSelect: (key: string) => void;
}) {
  return (
    <div
      role="grid"
      aria-label="Jours de la semaine"
      className="grid flex-1 grid-cols-7 gap-1.5 min-h-0 pt-1 pb-1"
    >
      {weekDaysOf(day).map((cellKey) => {
        const dayEvents = eventsByDay[cellKey] ?? NO_EVENTS;
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
            onClick={() => onSelect(cellKey)}
            className="flex flex-col gap-1 min-h-0 cursor-pointer select-none"
          >
            {/* Column day header button */}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(cellKey);
              }}
              className={`flex flex-col items-center justify-center rounded-control py-1 transition-colors ${
                isSelected
                  ? "bg-accent text-accent-ink shadow-xs"
                  : isToday
                    ? "border border-accent text-foreground"
                    : "bg-foreground/5 text-foreground [@media(hover:hover)]:hover:bg-foreground/10"
              }`}
            >
              <span className="text-[10px] uppercase font-semibold text-muted">{weekdayName}</span>
              <span className="text-xs font-bold leading-none mt-0.5">{cellDayNum}</span>
            </button>

            {/* Vertical bar (bâton vertical sans traits) */}
            <div
              className={`relative flex-1 min-h-0 rounded-control transition-colors overflow-hidden ${
                isSelected
                  ? "bg-foreground/10 ring-1 ring-accent/30"
                  : "bg-foreground/5 [@media(hover:hover)]:hover:bg-foreground/8"
              }`}
            >
              <WeekColumnEvents events={dayEvents} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
