import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicUserCount } from "./user-count";

const rpc = vi.fn();

// The cache directive and profile are Next.js build features: not under test here.
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
// `rpc()` returns a query builder: only the call, and the bounded wait, matter here.
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    rpc: (name: string) => ({ abortSignal: (signal: AbortSignal) => rpc(name, signal) }),
  }),
}));

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("getPublicUserCount", () => {
  it("reads the number of accounts through the public function", async () => {
    rpc.mockResolvedValue({ data: 842, error: null });
    expect(await getPublicUserCount()).toEqual({ ok: true, value: 842 });
    expect(rpc).toHaveBeenCalledWith("public_user_count", expect.any(AbortSignal));
  });

  it("reports a failure (function missing, database down) instead of throwing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function not found" } });
    expect(await getPublicUserCount()).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("refuses an answer that is not a number", async () => {
    rpc.mockResolvedValue({ data: "842", error: null });
    expect(await getPublicUserCount()).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("reports a thrown error", async () => {
    rpc.mockRejectedValue(new Error("network"));
    expect(await getPublicUserCount()).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("never throws out of the cached read (that would fail the build of /login), and logs the reason", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    await expect(getPublicUserCount()).resolves.toMatchObject({ ok: false });
    expect(console.warn).toHaveBeenCalledWith("Public user count unavailable:", "PGRST202");
  });
});
