import Link from "next/link";
import { PinIcon } from "@/components/icons";
import { blockStyle } from "./event-colors";
import { percentToDayPx, type PlacedEvent } from "./timeline";

/** Left strip of the day timeline (the hours), in rem: blocks start after it. */
export const DAY_GUTTER = "3rem";
/** Space kept free on the right of the blocks. */
const DAY_RIGHT_MARGIN = "0.5rem";

/** How much of an event a block of this height can show, like the iOS Calendar does. */
export type BlockDetail = "title" | "time" | "full";

/** One line below ~34 px, title and time below ~62 px, and everything above. Fewer columns leave room for more. */
export function detailFor(heightPx: number, columns: number): BlockDetail {
  if (heightPx < 34) return "title";
  if (heightPx < 62 || columns >= 3) return "time";
  return "full";
}

/**
 * One event on the day timeline, in the style of the iOS Calendar: a tinted block with a solid bar on the left and
 * the title, the time and the place in its colour, as much as its height allows. Blocks that overlap share the width
 * (`column` of `columns`). The whole block is the link to the event.
 */
export function DayEventBlock({ placed, hue }: { placed: PlacedEvent; hue: number }) {
  const { event, topPercent, heightPercent, column, columns } = placed;
  const detail = detailFor(percentToDayPx(heightPercent), columns);
  const free = `(100% - ${DAY_GUTTER} - ${DAY_RIGHT_MARGIN})`;

  return (
    <Link
      href={`/calendar/${event.id}`}
      prefetch={false}
      title={`${event.time} — ${event.title}${event.location ? ` (${event.location})` : ""}`}
      aria-label={`${event.time} ${event.title}`}
      data-column={column}
      data-columns={columns}
      style={{
        top: `${topPercent}%`,
        height: `calc(${heightPercent}% - 2px)`,
        left: `calc(${DAY_GUTTER} + ${free} * ${column} / ${columns})`,
        width: `calc(${free} / ${columns} - 2px)`,
        ...blockStyle(hue, event.finished),
      }}
      className="absolute z-10 flex flex-col justify-start gap-px overflow-hidden rounded-[calc(var(--radius-control)-0.5rem)] px-2 py-1 text-xs leading-tight transition-[filter] [@media(hover:hover)]:hover:brightness-95 active:brightness-95"
    >
      {detail === "title" ? (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className={`truncate font-semibold ${event.finished ? "line-through" : ""}`}>
            {event.title}
          </span>
          {columns < 3 && (
            <span className="shrink-0 text-[11px] tabular-nums opacity-80">
              {event.startTime ?? event.time}
            </span>
          )}
        </span>
      ) : (
        <>
          <span
            className={`font-semibold break-words ${
              detail === "full" || columns >= 3 ? "line-clamp-3" : "line-clamp-1"
            } ${event.finished ? "line-through" : ""}`}
          >
            {event.title}
          </span>
          {columns < 3 && (
            <span className="truncate text-[11px] tabular-nums opacity-80">
              {event.time}
              {event.finished && " · Terminé"}
            </span>
          )}
          {detail === "full" && event.location && (
            <span className="mt-0.5 flex items-start gap-1 text-[11px] opacity-80">
              <PinIcon className="mt-px size-3 shrink-0" />
              <span className="line-clamp-2 break-words">{event.location}</span>
            </span>
          )}
        </>
      )}
    </Link>
  );
}
