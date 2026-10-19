import { useEffect, useRef, type TouchEvent } from "react";
import type { CalendarViewMode } from "./calendar-types";

/** Fingers (or trackpad) must move this much apart / together before the view changes. */
const TOUCH_THRESHOLD_PX = 35;
const WHEEL_THRESHOLD = 15;
/** After a trackpad pinch changed the view, ignore the rest of the gesture for this long. */
const WHEEL_COOLDOWN_MS = 350;

const ZOOM_IN: Partial<Record<CalendarViewMode, CalendarViewMode>> = { month: "week", week: "day" };
const ZOOM_OUT: Partial<Record<CalendarViewMode, CalendarViewMode>> = {
  day: "week",
  week: "month",
};

/**
 * Pinch to zoom between the month, week and day views: two fingers on a touch screen (spread = zoom in, pinch =
 * zoom out) or a trackpad pinch (a wheel event with `ctrlKey`). Returns the ref to put on the calendar area and the
 * touch handlers to spread on it; the wheel listener is attached here (it must be non-passive to stop the browser
 * zoom) and removed with its cooldown timer on unmount.
 */
export function usePinchZoom(view: CalendarViewMode, changeView: (view: CalendarViewMode) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistance = useRef<number | null>(null);
  const gestureHandled = useRef(false);
  const wheelCooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  const distanceBetween = (event: TouchEvent<HTMLDivElement>) => {
    const [first, second] = [event.touches[0]!, event.touches[1]!];
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  const touchHandlers = {
    onTouchStart: (event: TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2) return;
      touchDistance.current = distanceBetween(event);
      gestureHandled.current = false;
    },
    onTouchMove: (event: TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2 || touchDistance.current === null || gestureHandled.current) {
        return;
      }
      const delta = distanceBetween(event) - touchDistance.current;
      const next =
        delta > TOUCH_THRESHOLD_PX
          ? ZOOM_IN[view]
          : delta < -TOUCH_THRESHOLD_PX
            ? ZOOM_OUT[view]
            : undefined;
      if (delta > TOUCH_THRESHOLD_PX || delta < -TOUCH_THRESHOLD_PX) gestureHandled.current = true;
      if (next) changeView(next);
    },
    onTouchEnd: () => {
      touchDistance.current = null;
      gestureHandled.current = false;
    },
    onTouchCancel: () => {
      touchDistance.current = null;
      gestureHandled.current = false;
    },
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (wheelCooldown.current !== null) return;
      if (Math.abs(event.deltaY) <= WHEEL_THRESHOLD) return;

      // Trackpad pinch-out (negative delta) zooms in, pinch-in zooms out.
      const next = event.deltaY < 0 ? ZOOM_IN[view] : ZOOM_OUT[view];
      wheelCooldown.current = setTimeout(() => {
        wheelCooldown.current = null;
      }, WHEEL_COOLDOWN_MS);
      if (next) changeView(next);
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      if (wheelCooldown.current !== null) clearTimeout(wheelCooldown.current);
      wheelCooldown.current = null;
    };
  }, [view, changeView]);

  return { containerRef, touchHandlers };
}
