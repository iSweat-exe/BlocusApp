import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeRole } from "./actions";

const requirePermission = vi.fn();
const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));

const TARGET = "00000000-0000-0000-0000-0000000000a1";
const form = (values: Record<string, string | undefined>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) data.set(key, value);
  });
  return data;
};
const IDLE = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ ok: true, value: { userId: "admin" } });
  rpc.mockResolvedValue({ error: null });
});

describe("changeRole database errors", () => {
  it("logs an unexpected error and still shows the generic message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ error: { code: "XX000", message: "something broke", hint: null } });

    expect(await changeRole(IDLE, form({ target: TARGET, role: "manager" }))).toEqual({
      status: "error",
      message: "La modification a échoué. Réessaie.",
    });
    expect(log).toHaveBeenCalledWith(
      "[changeRole] unexpected database error:",
      "XX000",
      "something broke",
      "",
    );
    log.mockRestore();
  });

  it("does not log an expected error such as a hierarchy violation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ error: { code: "42501", message: "hierarchy_violation" } });

    expect(await changeRole(IDLE, form({ target: TARGET, role: "admin" }))).toMatchObject({
      status: "error",
      message: expect.stringContaining("au-dessus"),
    });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("changeRole", () => {
  it("checks role.assign against the database", async () => {
    await changeRole(IDLE, form({ target: TARGET, role: "manager" }));
    expect(requirePermission).toHaveBeenCalledWith("role.assign", { fresh: true });
  });

  it("refuses Guests and users without the permission before touching roles", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "unauthenticated" });
    expect(await changeRole(IDLE, form({ target: TARGET, role: "manager" }))).toMatchObject({
      status: "error",
    });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await changeRole(IDLE, form({ target: TARGET, role: "manager" }))).toMatchObject({
      status: "error",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { target: "nope", role: "manager" },
    { target: TARGET, role: "Not A Role!" },
    { target: TARGET },
  ])("rejects malformed input (%j)", async (values) => {
    expect(await changeRole(IDLE, form(values))).toEqual({
      status: "error",
      message: "Demande invalide.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls assign_role and reports success", async () => {
    expect(await changeRole(IDLE, form({ target: TARGET, role: "manager" }))).toMatchObject({
      status: "success",
    });
    expect(rpc).toHaveBeenCalledWith("assign_role", { p_target: TARGET, p_role: "manager" });
  });

  it("translates database errors, with a generic fallback", async () => {
    rpc.mockResolvedValue({ error: { message: "hierarchy_violation" } });
    expect(await changeRole(IDLE, form({ target: TARGET, role: "admin" }))).toMatchObject({
      status: "error",
      message: expect.stringContaining("niveau du tien"),
    });
    rpc.mockResolvedValue({ error: { message: "something unexpected" } });
    expect(await changeRole(IDLE, form({ target: TARGET, role: "admin" }))).toMatchObject({
      status: "error",
      message: expect.stringContaining("Réessaie"),
    });
  });
});
