import { useEffect, type RefObject } from "react";

const CLOSE_DISTANCE = 100; // px dragged down that dismisses the sheet
const CLOSE_VELOCITY = 0.5; // px/ms: a quick flick dismisses it too
const SLIDE_MS = 200;

/**
 * Swipe-down-to-dismiss for a bottom sheet, like iOS. Touch only (the popover layout on larger screens
 * has no gesture). The sheet follows the finger and, on release, either slides away (then `onDismiss`)
 * or springs back. A drag that starts inside `scrollRef` only counts when that list is scrolled to the
 * top, so scrolling a long list never closes the sheet. Moves the DOM directly (no React re-render).
 */
export function useSheetSwipe({
  active,
  sheetRef,
  backdropRef,
  scrollRef,
  onDismiss,
}: {
  active: boolean;
  sheetRef: RefObject<HTMLElement | null>;
  backdropRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}): void {
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!active || !sheet) return;
    const backdrop = backdropRef.current;

    let startY = 0;
    let startTime = 0;
    let eligible = false;
    let dragging = false;
    let offset = 0;
    let timer: number | undefined;

    const paint = (y: number, animated: boolean) => {
      sheet.style.transition = animated ? `transform ${SLIDE_MS}ms ease-out` : "none";
      sheet.style.transform = `translateY(${y}px)`;
      if (backdrop) {
        backdrop.style.transition = animated ? `opacity ${SLIDE_MS}ms ease-out` : "none";
        backdrop.style.opacity = String(Math.max(0, 1 - y / sheet.offsetHeight));
      }
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      // The popover layout (`sm` and up) has no gesture.
      if (!touch || window.matchMedia?.("(min-width: 640px)").matches) {
        eligible = false;
        return;
      }
      const inList = scrollRef.current?.contains(event.target as Node) ?? false;
      eligible = !inList || (scrollRef.current?.scrollTop ?? 0) <= 0;
      startY = touch.clientY;
      startTime = performance.now();
      dragging = false;
      offset = 0;
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!eligible || !touch) return;
      const delta = touch.clientY - startY;
      if (!dragging && delta <= 0) return; // upward gestures scroll normally
      dragging = true;
      offset = Math.max(0, delta);
      if (event.cancelable) event.preventDefault();
      paint(offset, false);
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const velocity = offset / Math.max(1, performance.now() - startTime);
      if (offset > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
        paint(sheet.offsetHeight, true);
        timer = window.setTimeout(onDismiss, SLIDE_MS);
      } else {
        paint(0, true);
      }
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    // Not passive: the move handler cancels the native scroll while the sheet is being dragged.
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
    return () => {
      window.clearTimeout(timer);
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [active, sheetRef, backdropRef, scrollRef, onDismiss]);
}
