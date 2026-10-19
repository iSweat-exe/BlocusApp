import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  markOnboardingDone,
  ONBOARDING_STORAGE_KEY,
  readOnboardingDone,
  subscribeToOnboarding,
} from "./onboarding-store";

beforeEach(() => {
  window.localStorage.clear();
});

describe("onboarding store", () => {
  it("is not done on a fresh device, then remembered once finished", () => {
    // `closedForNow` is module state: a fresh module is needed for the "not done" case.
    vi.resetModules();
    return import("./onboarding-store").then((fresh) => {
      expect(fresh.readOnboardingDone()).toBe(false);
      fresh.markOnboardingDone();
      expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).not.toBeNull();
      expect(fresh.readOnboardingDone()).toBe(true);
    });
  });

  it("tells subscribers when it gets closed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToOnboarding(listener);
    markOnboardingDone();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    markOnboardingDone();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stays closed for the page view when the storage refuses the write", () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    return import("./onboarding-store").then((fresh) => {
      fresh.markOnboardingDone();
      expect(fresh.readOnboardingDone()).toBe(true);
      vi.restoreAllMocks();
    });
  });

  it("counts as done when the storage is blocked, to never nag on every page", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readOnboardingDone()).toBe(true);
    vi.restoreAllMocks();
  });
});
