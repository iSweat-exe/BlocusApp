import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_AWAY_MS, MIN_REFRESH_GAP_MS, RefreshOnReturn } from "./refresh-on-return";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};
/** Hides the app, waits, and shows it again. */
const awayFor = (ms: number) => {
  setVisibility("hidden");
  vi.advanceTimersByTime(ms);
  setVisibility("visible");
};
const pageShow = (persisted: boolean) =>
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  refresh.mockClear();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => vi.useRealTimers());

describe("RefreshOnReturn", () => {
  it("renders nothing and does not refresh right after the page was rendered", () => {
    const { container } = render(<RefreshOnReturn />);
    expect(container).toBeEmptyDOMElement();
    awayFor(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("ignores a quick switch to another app, even long after the page was rendered", () => {
    render(<RefreshOnReturn />);
    vi.advanceTimersByTime(MIN_AWAY_MS * 10);
    awayFor(5_000);
    expect(refresh).not.toHaveBeenCalled();
    awayFor(MIN_AWAY_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when the user comes back after being away long enough, but not twice in a row", () => {
    render(<RefreshOnReturn />);
    awayFor(MIN_AWAY_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    awayFor(MIN_AWAY_MS - 1);
    expect(refresh).toHaveBeenCalledTimes(1);

    awayFor(MIN_AWAY_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the page is hidden (no work in the background)", () => {
    render(<RefreshOnReturn />);
    setVisibility("hidden");
    vi.advanceTimersByTime(MIN_AWAY_MS * 10);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when restored from the back/forward cache after a long time, or when the network returns", () => {
    render(<RefreshOnReturn />);
    vi.advanceTimersByTime(MIN_AWAY_MS + 1);
    pageShow(false);
    expect(refresh).not.toHaveBeenCalled();
    pageShow(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MIN_REFRESH_GAP_MS + 1);
    window.dispatchEvent(new Event("online"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on a back/forward cache restore when the user was away only briefly", () => {
    render(<RefreshOnReturn />);
    vi.advanceTimersByTime(MIN_AWAY_MS * 5);
    setVisibility("hidden");
    vi.advanceTimersByTime(3_000);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    pageShow(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("removes its listeners when unmounted", () => {
    const { unmount } = render(<RefreshOnReturn />);
    unmount();
    vi.advanceTimersByTime(MIN_AWAY_MS + 1);
    awayFor(MIN_AWAY_MS);
    pageShow(true);
    window.dispatchEvent(new Event("online"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
