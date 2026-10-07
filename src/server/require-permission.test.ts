import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "./require-permission";

const getClaims = vi.fn();
const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getClaims }, rpc }),
}));

describe("requirePermission", () => {
  beforeEach(() => {
    getClaims.mockReset();
    rpc.mockReset();
  });

  it("rejects visitors without a session", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect(await requirePermission("announcement.publish")).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it("accepts a permission present in the JWT claims", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1", permissions: ["announcement.publish"] } },
    });
    expect(await requirePermission("announcement.publish")).toEqual({
      ok: true,
      value: { userId: "u1" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { sub: "u1" },
    { sub: "u1", permissions: "announcement.publish" },
    { sub: "u1", permissions: [] },
  ])("denies when the claims do not grant the permission (%j)", async (claims) => {
    getClaims.mockResolvedValue({ data: { claims } });
    expect(await requirePermission("announcement.publish")).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("asks the database when `fresh` is set, ignoring stale claims", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", permissions: ["user.ban"] } } });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await requirePermission("user.ban", { fresh: true })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(rpc).toHaveBeenCalledWith("has_permission", {
      p_user_id: "u1",
      p_permission: "user.ban",
    });

    rpc.mockResolvedValue({ data: true, error: null });
    expect((await requirePermission("user.ban", { fresh: true })).ok).toBe(true);
  });

  it("denies when the database check errors", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    rpc.mockResolvedValue({ data: true, error: { message: "boom" } });
    expect((await requirePermission("user.ban", { fresh: true })).ok).toBe(false);
  });
});
