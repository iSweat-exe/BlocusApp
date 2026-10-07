import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSheetSwipe } from "./use-sheet-swipe";

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useSheetSwipe({ active: true, sheetRef, backdropRef, scrollRef: listRef, onDismiss });
  return (
    <>
      <div ref={backdropRef} data-testid="backdrop" />
      <div ref={sheetRef} data-testid="sheet">
        <p data-testid="handle">handle</p>
        <ul ref={listRef} data-testid="list" />
      </div>
    </>
  );
}

const touch = (y: number) => ({ touches: [{ clientY: y }] });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useSheetSwipe", () => {
  it("dismisses the sheet after a long swipe down", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    const handle = getByTestId("handle");
    fireEvent.touchStart(handle, touch(100));
    fireEvent.touchMove(handle, touch(160));
    expect(getByTestId("sheet").style.transform).toBe("translateY(60px)");
    fireEvent.touchMove(handle, touch(300));
    fireEvent.touchEnd(handle);
    act(() => void vi.advanceTimersByTime(250));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("springs back after a short slow swipe", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    const handle = getByTestId("handle");
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(1000);
    fireEvent.touchStart(handle, touch(100));
    fireEvent.touchMove(handle, touch(130));
    fireEvent.touchEnd(handle);
    act(() => void vi.advanceTimersByTime(250));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(getByTestId("sheet").style.transform).toBe("translateY(0px)");
  });

  it("ignores swipes up and swipes starting in a scrolled list", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    const handle = getByTestId("handle");
    fireEvent.touchStart(handle, touch(300));
    fireEvent.touchMove(handle, touch(100));
    fireEvent.touchEnd(handle);

    const list = getByTestId("list");
    list.scrollTop = 40;
    fireEvent.touchStart(list, touch(100));
    fireEvent.touchMove(list, touch(400));
    fireEvent.touchEnd(list);
    act(() => void vi.advanceTimersByTime(250));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
