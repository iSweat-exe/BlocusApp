import { beforeEach, describe, expect, it, vi } from "vitest";
import { setUserPermission, toggleRolePermission } from "./permission-actions";

const requirePermission = vi.fn();
const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));

const TARGET = "00000000-0000-0000-0000-0000000000a1";
const IDLE = { status: "idle" } as const;
const form = (values: Record<string, string | undefined>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) data.set(key, value);
  });
  return data;
};
const ROLE_FORM = { role: "moderator", permission: "announcement.publish", granted: "true" };
const USER_FORM = { target: TARGET, permission: "user.mute", effect: "grant" };

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ ok: true, value: { userId: "admin" } });
  rpc.mockResolvedValue({ error: null });
});

describe.each([
  ["toggleRolePermission", toggleRolePermission, ROLE_FORM],
  ["setUserPermission", setUserPermission, USER_FORM],
] as const)("%s guard", (_name, action, valid) => {
  it("checks permission.manage against the database", async () => {
    await action(IDLE, form(valid));
    expect(requirePermission).toHaveBeenCalledWith("permission.manage", { fresh: true });
  });

  it("refuses Guests and users without the permission before touching the database", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "unauthenticated" });
    expect(await action(IDLE, form(valid))).toMatchObject({ status: "error" });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await action(IDLE, form(valid))).toMatchObject({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("toggleRolePermission", () => {
  it.each([
    { ...ROLE_FORM, role: "Not A Role" },
    { ...ROLE_FORM, permission: "nodot" },
    { ...ROLE_FORM, granted: "maybe" },
    { permission: "a.b", granted: "true" },
  ])("rejects malformed input (%j)", async (values) => {
    expect(await toggleRolePermission(IDLE, form(values))).toEqual({
      status: "error",
      message: "Demande invalide.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_role_permission with a boolean", async () => {
    expect(await toggleRolePermission(IDLE, form(ROLE_FORM))).toMatchObject({ status: "success" });
    expect(rpc).toHaveBeenCalledWith("set_role_permission", {
      p_role: "moderator",
      p_permission: "announcement.publish",
      p_granted: true,
    });
    await toggleRolePermission(IDLE, form({ ...ROLE_FORM, granted: "false" }));
    expect(rpc).toHaveBeenLastCalledWith(
      "set_role_permission",
      expect.objectContaining({ p_granted: false }),
    );
  });

  it("translates database errors, with a generic fallback", async () => {
    rpc.mockResolvedValue({ error: { message: "privilege_escalation" } });
    expect(await toggleRolePermission(IDLE, form(ROLE_FORM))).toMatchObject({
      status: "error",
      message: expect.stringContaining("que tu possèdes"),
    });
    rpc.mockResolvedValue({ error: { message: "weird" } });
    expect(await toggleRolePermission(IDLE, form(ROLE_FORM))).toMatchObject({
      status: "error",
      message: expect.stringContaining("Réessaie"),
    });
  });
});

describe("setUserPermission", () => {
  it.each([
    { ...USER_FORM, target: "nope" },
    { ...USER_FORM, permission: "nodot" },
    { ...USER_FORM, effect: "maybe" },
    { permission: "a.b", effect: "grant" },
  ])("rejects malformed input (%j)", async (values) => {
    expect(await setUserPermission(IDLE, form(values))).toEqual({
      status: "error",
      message: "Demande invalide.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sets an override, and clears it with a null effect", async () => {
    expect(await setUserPermission(IDLE, form(USER_FORM))).toMatchObject({ status: "success" });
    expect(rpc).toHaveBeenLastCalledWith("set_user_permission", {
      p_target: TARGET,
      p_permission: "user.mute",
      p_effect: "grant",
    });
    await setUserPermission(IDLE, form({ ...USER_FORM, effect: "clear" }));
    expect(rpc).toHaveBeenLastCalledWith("set_user_permission", {
      p_target: TARGET,
      p_permission: "user.mute",
      p_effect: null,
    });
  });

  it("translates database errors", async () => {
    rpc.mockResolvedValue({ error: { message: "hierarchy_violation" } });
    expect(await setUserPermission(IDLE, form(USER_FORM))).toMatchObject({
      status: "error",
      message: expect.stringContaining("niveau du tien"),
    });
  });
});
