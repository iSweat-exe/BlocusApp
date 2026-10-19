import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarViewMode } from "./calendar-types";
import { usePinchZoom } from "./use-pinch-zoom";

function Area({
  view,
  changeView,
}: {
  view: CalendarViewMode;
  changeView: (view: CalendarViewMode) => void;
}) {
  const { containerRef, touchHandlers } = usePinchZoom(view, changeView);
  return <div ref={containerRef} data-testid="area" {...touchHandlers} />;
}

const fingers = (a: number, b: number) => [
  { clientX: a, clientY: 0 },
  { clientX: b, clientY: 0 },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("usePinchZoom", () => {
  it("zooms in when two fingers spread, and out when they come together", () => {
    const changeView = vi.fn();
    const { getByTestId, rerender } = render(<Area view="month" changeView={changeView} />);
    const area = getByTestId("area");

    fireEvent.touchStart(area, { touches: fingers(100, 120) });
    fireEvent.touchMove(area, { touches: fingers(60, 160) });
    expect(changeView).toHaveBeenCalledWith("week");

    // One gesture changes the view once, however long the fingers keep moving.
    fireEvent.touchMove(area, { touches: fingers(20, 200) });
    expect(changeView).toHaveBeenCalledTimes(1);
    fireEvent.touchEnd(area);

    rerender(<Area view="day" changeView={changeView} />);
    fireEvent.touchStart(area, { touches: fingers(60, 160) });
    fireEvent.touchMove(area, { touches: fingers(100, 120) });
    expect(changeView).toHaveBeenLastCalledWith("week");
  });

  it("ignores a small movement, a single finger and the ends of the scale", () => {
    const changeView = vi.fn();
    const { getByTestId, rerender } = render(<Area view="month" changeView={changeView} />);
    const area = getByTestId("area");

    fireEvent.touchStart(area, { touches: fingers(100, 120) });
    fireEvent.touchMove(area, { touches: fingers(95, 130) });
    fireEvent.touchStart(area, { touches: [{ clientX: 1, clientY: 1 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 90, clientY: 1 }] });
    expect(changeView).not.toHaveBeenCalled();

    // Already on the month: pinching in has nowhere to go.
    fireEvent.touchEnd(area);
    fireEvent.touchStart(area, { touches: fingers(60, 160) });
    fireEvent.touchMove(area, { touches: fingers(100, 120) });
    expect(changeView).not.toHaveBeenCalled();
    rerender(<Area view="day" changeView={changeView} />);
  });

  it("follows a trackpad pinch (wheel with ctrl), once per cooldown, and keeps the page from zooming", () => {
    const changeView = vi.fn();
    const { getByTestId } = render(<Area view="week" changeView={changeView} />);
    const area = getByTestId("area");

    const plain = new WheelEvent("wheel", { deltaY: -40, cancelable: true });
    act(() => void area.dispatchEvent(plain));
    expect(changeView).not.toHaveBeenCalled();
    expect(plain.defaultPrevented).toBe(false);

    const pinch = new WheelEvent("wheel", { deltaY: -40, ctrlKey: true, cancelable: true });
    act(() => void area.dispatchEvent(pinch));
    expect(pinch.defaultPrevented).toBe(true);
    expect(changeView).toHaveBeenCalledWith("day");

    act(() => void area.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, ctrlKey: true })));
    expect(changeView).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(400));
    act(() => void area.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, ctrlKey: true })));
    expect(changeView).toHaveBeenLastCalledWith("month");
  });

  it("clears its cooldown timer and listener on unmount", () => {
    const changeView = vi.fn();
    const { getByTestId, unmount } = render(<Area view="week" changeView={changeView} />);
    const area = getByTestId("area");
    act(() => void area.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, ctrlKey: true })));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => void area.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, ctrlKey: true })));
    expect(changeView).toHaveBeenCalledTimes(1);
  });
});
