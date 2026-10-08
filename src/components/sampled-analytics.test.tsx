import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_SAMPLE_RATE, isSampled } from "./sampled-analytics";

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("isSampled", () => {
  it("keeps the browsers under the sample rate and drops the others", () => {
    expect(isSampled(() => ANALYTICS_SAMPLE_RATE - 0.001)).toBe(true);
    window.localStorage.clear();
    expect(isSampled(() => ANALYTICS_SAMPLE_RATE)).toBe(false);
  });

  it("remembers the draw: a visitor is never split between sampled and not sampled", () => {
    expect(isSampled(() => 0)).toBe(true);
    expect(isSampled(() => 0.99)).toBe(true);
    window.localStorage.clear();
    expect(isSampled(() => 0.99)).toBe(false);
    expect(isSampled(() => 0)).toBe(false);
  });

  it("still draws when the storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(isSampled(() => 0)).toBe(true);
    expect(isSampled(() => 0.99)).toBe(false);
  });
});
