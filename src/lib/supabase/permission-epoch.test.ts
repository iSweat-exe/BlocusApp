import { describe, expect, it, vi } from "vitest";
import { createEpochReader, EPOCH_TTL_MS, isTokenStale } from "./permission-epoch";

describe("isTokenStale", () => {
  const epoch = "2026-10-08T10:00:00.000Z";
  const at = (iso: string) => Date.parse(iso) / 1000;

  it("is stale when the token was issued before the last permission change", () => {
    expect(isTokenStale(at("2026-10-08T09:59:59Z"), epoch)).toBe(true);
  });

  it("is fresh when the token was issued at or after it", () => {
    expect(isTokenStale(at("2026-10-08T10:00:00Z"), epoch)).toBe(false);
    expect(isTokenStale(at("2026-10-08T10:05:00Z"), epoch)).toBe(false);
  });

  it("never asks for a refresh on doubt", () => {
    expect(isTokenStale(undefined, epoch)).toBe(false);
    expect(isTokenStale("123", epoch)).toBe(false);
    expect(isTokenStale(Number.NaN, epoch)).toBe(false);
    expect(isTokenStale(1, null)).toBe(false);
    expect(isTokenStale(1, "not a date")).toBe(false);
  });
});

describe("createEpochReader", () => {
  it("reads once per time-to-live, however many callers", async () => {
    let now = 1_000;
    const read = vi.fn().mockResolvedValue("2026-10-08T10:00:00Z");
    const get = createEpochReader(read, () => now);

    await Promise.all([get(), get(), get()]);
    await get();
    expect(read).toHaveBeenCalledTimes(1);

    now += EPOCH_TTL_MS + 1;
    await get();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps the last known value when the database fails", async () => {
    let now = 0;
    const read = vi
      .fn()
      .mockResolvedValueOnce("2026-10-08T10:00:00Z")
      .mockRejectedValueOnce(new Error("down"));
    const get = createEpochReader(read, () => now);

    expect(await get()).toBe("2026-10-08T10:00:00Z");
    now += EPOCH_TTL_MS + 1;
    expect(await get()).toBe("2026-10-08T10:00:00Z");
  });

  it("returns null when it has never been able to read", async () => {
    const get = createEpochReader(() => Promise.reject(new Error("down")));
    expect(await get()).toBeNull();
  });
});
