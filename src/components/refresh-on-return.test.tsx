import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_REFRESH_GAP_MS, RefreshOnReturn } from "./refresh-on-return";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const setVisibility = (state: "visible" | "hidden") =>
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
const comeBack = () => document.dispatchEvent(new Event("visibilitychange"));
const pageShow = (persisted: boolean) =>
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  refresh.mockClear();
  setVisibility("visible");
});
afterEach(() => vi.useRealTimers());

describe("RefreshOnReturn", () => {
  it("renders nothing and does not refresh right after the page was rendered", () => {
    const { container } = render(<RefreshOnReturn />);
    expect(container).toBeEmptyDOMElement();
    comeBack();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when the user comes back after the minimum gap, but not twice in a row", () => {
    render(<RefreshOnReturn />);
    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS + 1);
    comeBack();
    expect(refresh).toHaveBeenCalledTimes(1);

    comeBack();
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS + 1);
    comeBack();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the page is hidden (no work in the background)", () => {
    render(<RefreshOnReturn />);
    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS * 10);
    setVisibility("hidden");
    comeBack();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("also refreshes when restored from the back/forward cache, or when the network returns", () => {
    render(<RefreshOnReturn />);
    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS + 1);
    pageShow(false);
    expect(refresh).not.toHaveBeenCalled();
    pageShow(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS + 1);
    window.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("removes its listeners when unmounted", () => {
    const { unmount } = render(<RefreshOnReturn />);
    unmount();
    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS + 1);
    comeBack();
    pageShow(true);
    window.dispatchEvent(new Event("online"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
