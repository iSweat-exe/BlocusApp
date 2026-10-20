import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markWhatsNewSeen,
  readWhatsNewSeen,
  subscribeToWhatsNew,
  WHATS_NEW_BLOCKED,
  WHATS_NEW_STORAGE_KEY,
} from "./whats-new-store";

beforeEach(() => {
  window.localStorage.clear();
});

// Restored after each test: the "blocked" test makes `window.localStorage` throw, `clear()` above must not see it.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("whats-new store", () => {
  it("has no date on a fresh device, then keeps the one it was given", () => {
    expect(readWhatsNewSeen()).toBeNull();
    markWhatsNewSeen("2026-10-20");
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026-10-20");
    expect(readWhatsNewSeen()).toBe("2026-10-20");
  });

  it("tells subscribers when the date changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWhatsNew(listener);
    markWhatsNewSeen("2026-10-20");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    markWhatsNewSeen("2026-10-21");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reports the storage as blocked when it cannot be read", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readWhatsNewSeen()).toBe(WHATS_NEW_BLOCKED);
  });

  it("stays closed for the page view when the storage refuses the write", async () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const fresh = await import("./whats-new-store");
    fresh.markWhatsNewSeen("2026-10-20");
    expect(fresh.readWhatsNewSeen()).toBe(fresh.WHATS_NEW_BLOCKED);
  });
});
