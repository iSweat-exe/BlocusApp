import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventOfDate, EVENT_STORAGE_KEY, resolveEvent } from "./event";
import { EVENT_BOOT_SCRIPT } from "./event-script";

describe("eventOfDate", () => {
  it("is Halloween on 31 October only", () => {
    expect(eventOfDate(new Date(2026, 9, 31))).toBe("halloween");
    expect(eventOfDate(new Date(2027, 9, 31, 23, 59))).toBe("halloween");
    expect(eventOfDate(new Date(2026, 9, 30))).toBeNull();
    expect(eventOfDate(new Date(2026, 10, 1))).toBeNull();
    expect(eventOfDate(new Date(2026, 11, 31))).toBeNull();
  });
});

describe("resolveEvent", () => {
  it("follows the calendar without a preview", () => {
    expect(resolveEvent(new Date(2026, 9, 31), null)).toBe("halloween");
    expect(resolveEvent(new Date(2026, 5, 1), null)).toBeNull();
  });

  it("lets the preview force the event on any day, or switch it off on its day", () => {
    expect(resolveEvent(new Date(2026, 5, 1), "halloween")).toBe("halloween");
    expect(resolveEvent(new Date(2026, 9, 31), "off")).toBeNull();
  });

  it("ignores an unknown preview", () => {
    expect(resolveEvent(new Date(2026, 9, 31), "christmas")).toBe("halloween");
    expect(resolveEvent(new Date(2026, 5, 1), "christmas")).toBeNull();
  });
});

describe("EVENT_BOOT_SCRIPT", () => {
  function run() {
    new Function(EVENT_BOOT_SCRIPT)();
    return document.documentElement.getAttribute("data-event");
  }

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-event");
    window.history.replaceState(null, "", "/");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["31 October", new Date(2026, 9, 31, 12), null, "halloween"],
    ["another day", new Date(2026, 5, 1, 12), null, null],
    ["another day with the preview on", new Date(2026, 5, 1, 12), "halloween", "halloween"],
    ["31 October with the preview off", new Date(2026, 9, 31, 12), "off", null],
  ])("gives what resolveEvent gives on %s", (_name, now, preview, expected) => {
    vi.setSystemTime(now);
    if (preview) window.localStorage.setItem(EVENT_STORAGE_KEY, preview);
    expect(run()).toBe(expected);
    expect(resolveEvent(now, preview)).toBe(expected);
  });

  it("stores the preview from ?event= and clears it with ?event=reset", () => {
    vi.setSystemTime(new Date(2026, 5, 1, 12));
    window.history.replaceState(null, "", "/?event=halloween");
    expect(run()).toBe("halloween");
    expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBe("halloween");

    document.documentElement.removeAttribute("data-event");
    window.history.replaceState(null, "", "/?event=reset");
    expect(run()).toBeNull();
    expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBeNull();
  });

  it("still follows the calendar when the storage is blocked", () => {
    vi.setSystemTime(new Date(2026, 9, 31, 12));
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run()).toBe("halloween");
    vi.restoreAllMocks();
  });
});
