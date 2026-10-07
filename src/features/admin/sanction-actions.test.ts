import { beforeEach, describe, expect, it, vi } from "vitest";
import { banUser, liftSanction } from "./sanction-actions";

const requirePermission = vi.fn();
const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));

const TARGET = "00000000-0000-0000-0000-0000000000a1";
const SANCTION = "00000000-0000-0000-0000-00000000b001";
const IDLE = { status: "idle" } as const;
const form = (values: Record<string, string | undefined>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) data.set(key, value);
  });
  return data;
};
const VALID = { target: TARGET, reason: "spam", duration: "permanent" };

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ ok: true, value: { userId: "admin" } });
  rpc.mockResolvedValue({ error: null });
});

describe("banUser", () => {
  it("checks user.ban against the database", async () => {
    await banUser(IDLE, form(VALID));
    expect(requirePermission).toHaveBeenCalledWith("user.ban", { fresh: true });
  });

  it("refuses Guests and users without the permission before touching the database", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "unauthenticated" });
    expect(await banUser(IDLE, form(VALID))).toMatchObject({ status: "error" });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await banUser(IDLE, form(VALID))).toMatchObject({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed target and returns field errors", async () => {
    expect(await banUser(IDLE, form({ ...VALID, target: "nope" }))).toEqual({
      status: "error",
      message: "Demande invalide.",
    });
    expect(await banUser(IDLE, form({ ...VALID, reason: " " }))).toMatchObject({
      status: "error",
      fieldErrors: { reason: expect.any(String) },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bans permanently (no expiry) or until a computed date", async () => {
    expect(await banUser(IDLE, form(VALID))).toMatchObject({ status: "success" });
    expect(rpc).toHaveBeenLastCalledWith("ban_user", {
      p_target: TARGET,
      p_reason: "spam",
      p_expires_at: undefined,
    });

    await banUser(IDLE, form({ ...VALID, duration: "1h" }));
    const call = rpc.mock.calls.at(-1)?.[1] as { p_expires_at: string };
    expect(new Date(call.p_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("translates database errors, with a generic fallback", async () => {
    rpc.mockResolvedValue({ error: { message: "already_banned" } });
    expect(await banUser(IDLE, form(VALID))).toMatchObject({
      status: "error",
      message: expect.stringContaining("déjà banni"),
    });
    rpc.mockResolvedValue({ error: { message: "weird" } });
    expect(await banUser(IDLE, form(VALID))).toMatchObject({
      status: "error",
      message: expect.stringContaining("Réessaie"),
    });
  });
});

describe("liftSanction", () => {
  it("ignores malformed ids", async () => {
    await liftSanction(form({ id: "nope", target: TARGET }));
    await liftSanction(form({ id: SANCTION, target: "nope" }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does nothing without user.ban", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    await liftSanction(form({ id: SANCTION, target: TARGET }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("revokes the sanction", async () => {
    await liftSanction(form({ id: SANCTION, target: TARGET }));
    expect(rpc).toHaveBeenCalledWith("revoke_sanction", { p_id: SANCTION });
  });
});
