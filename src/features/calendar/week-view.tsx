import Link from "next/link";
import { PinIcon } from "@/components/icons";
import type { DayEvent } from "./calendar-types";
import { computeEventBounds } from "./timeline";
import { formatDayKeyLong, weekDaysOf } from "./time";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Week view: 7 vertical bars (one per day) spanning 6h-24h without scroll, with proportional event blocks. Tapping
 * a column selects its day (`onSelect`).
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
  const select = onSelect;
  return (
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
                    className={`absolute inset-x-0.5 rounded-[calc(var(--radius-control)-0.125rem)] p-1 text-[10px] leading-tight overflow-hidden transition-transform [@media(hover:hover)]:hover:scale-105 z-10 flex flex-col justify-between ${
                      event.finished
                        ? "bg-foreground/20 text-foreground/60 line-through"
                        : "bg-accent text-accent-ink font-semibold shadow-xs"
                    }`}
                  >
                    {/* 1. Heure en haut */}
                    <span className="block text-[9px] font-semibold tabular-nums opacity-90 shrink-0 leading-none">
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
  );
}
