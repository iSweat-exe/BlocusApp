import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_DATA_TAGS } from "@/lib/data/cache-tags";
import { refreshPublicData } from "./actions";

const updateTag = vi.fn();
const refresh = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (...args: unknown[]) => updateTag(...args),
  refresh: () => refresh(),
}));

let clock = new Date("2030-01-01T00:00:00Z").getTime();
beforeEach(() => {
  vi.useFakeTimers();
  // Each test starts well after the previous one, so the per-instance limit has expired.
  clock += 3_600_000;
  vi.setSystemTime(clock);
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("refreshPublicData", () => {
  it("expires every public cache tag", async () => {
    await refreshPublicData();
    expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual([...PUBLIC_DATA_TAGS]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("only re-renders when pressed again within 10 s", async () => {
    await refreshPublicData();
    updateTag.mockClear();
    vi.advanceTimersByTime(9_999);
    await refreshPublicData();
    expect(updateTag).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("expires again once the window has passed", async () => {
    await refreshPublicData();
    updateTag.mockClear();
    vi.advanceTimersByTime(10_000);
    await refreshPublicData();
    expect(updateTag).toHaveBeenCalledTimes(PUBLIC_DATA_TAGS.length);
  });
});
