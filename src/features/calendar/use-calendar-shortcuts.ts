import { useEffect } from "react";
import type { CalendarViewMode } from "./calendar-types";

/** The letters that open a view (the initials of Mois, Semaine, Jour). */
const VIEW_KEYS: Record<string, CalendarViewMode> = { m: "month", s: "week", j: "day" };

/** What a key does to the date, by the `data-calendar-nav` of the link it presses. */
const NAV_KEYS: Record<string, "prev" | "next" | "today"> = {
  arrowleft: "prev",
  arrowright: "next",
  t: "today",
};

/**
 * Whether a key press is meant for something else than the calendar: a field being typed in, an open list or menu,
 * a dialog on top of the page.
 */
function belongsToSomethingElse(target: EventTarget | null): boolean {
  if (document.querySelector("dialog[open]")) return true;
  return (
    target instanceof Element &&
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='listbox'], [role='menu']",
    ) !== null
  );
}

/**
 * Keyboard shortcuts of the calendar, for a desktop: M, S and J open the month, the week and the day, the left and
 * right arrows go to the previous and the next period, T comes back to today. The arrows and T press the very links
 * the screen shows (`data-calendar-nav`), so a shortcut does exactly what a click does, including loading another
 * month. Nothing happens with Ctrl, Cmd or Alt held (the browser's own shortcuts), while typing, or under a dialog.
 */
export function useCalendarShortcuts(changeView: (view: CalendarViewMode) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (belongsToSomethingElse(event.target)) return;

      const key = event.key.toLowerCase();
      const view = VIEW_KEYS[key];
      if (view) {
        event.preventDefault();
        changeView(view);
        return;
      }
      const nav = NAV_KEYS[key];
      if (!nav) return;
      const link = document.querySelector<HTMLElement>(`[data-calendar-nav="${nav}"]`);
      if (link) {
        event.preventDefault();
        link.click();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [changeView]);
}
