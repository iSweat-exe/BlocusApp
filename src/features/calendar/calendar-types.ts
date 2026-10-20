import type { ComponentType, SVGProps } from "react";
import { monthKeyOf, parseDayKey, parseMonthKey, parseWeekKey, weekKeyOf } from "./time";
import { ViewDayIcon, ViewMonthIcon, ViewWeekIcon } from "./view-icons";

export type CalendarViewMode = "month" | "week" | "day";

export type ViewOption = {
  id: CalendarViewMode;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The key that opens this view on a keyboard (a letter, in the language of the labels). */
  shortcut: string;
};

export const VIEW_OPTIONS: readonly ViewOption[] = [
  { id: "month", label: "Mois", Icon: ViewMonthIcon, shortcut: "M" },
  { id: "week", label: "Semaine", Icon: ViewWeekIcon, shortcut: "S" },
  { id: "day", label: "Jour", Icon: ViewDayIcon, shortcut: "J" },
] as const;

/** Resolves the view mode from search parameters with safe fallback to month. */
export function resolveCalendarViewMode(params: {
  view?: string | null;
  month?: string | null;
  week?: string | null;
  day?: string | null;
}): CalendarViewMode {
  if (params.view === "week" || params.view === "day" || params.view === "month") {
    return params.view;
  }
  if (params.week && parseWeekKey(params.week)) {
    return "week";
  }
  // When only day is specified without a month, default to day view
  if (params.day && parseDayKey(params.day) && !params.month) {
    return "day";
  }
  return "month";
}

/** Builds the URL query string according to the requested view zoom. */
export function buildCalendarHref(params: {
  view: CalendarViewMode;
  day: string;
  month?: string;
  week?: string;
}): string {
  const { view, day } = params;
  if (view === "week") {
    const week = params.week && parseWeekKey(params.week) ? params.week : weekKeyOf(day);
    return `/calendar?view=week&week=${week}&day=${day}`;
  }
  if (view === "day") {
    return `/calendar?view=day&day=${day}`;
  }
  const month = params.month && parseMonthKey(params.month) ? params.month : monthKeyOf(day);
  return `/calendar?view=month&month=${month}&day=${day}`;
}

/** An event of the month as the client needs it: the server has already formatted the time range. */
export type DayEvent = {
  id: string;
  title: string;
  location: string;
  time: string;
  finished: boolean;
  /** Fractional hour of the start (`9.5` is 9:30), from 0 to 24. */
  startHour?: number;
  /**
   * Fractional hour of the end, up to 24 (an event that runs past midnight stops there). Left out when the event
   * has no end: the timeline then draws the default length, and `time` is the start alone.
   */
  endHour?: number;
  /** Exact start (`HH:MM`, local time), shown on the right of the day timeline. Not clamped like `startHour`. */
  startTime?: string;
};
