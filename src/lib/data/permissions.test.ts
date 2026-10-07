import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPermissions, listRolePermissions, listUserOverrides } from "./permissions";

const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
});

describe("listPermissions", () => {
  beforeEach(() => select.mockReturnValue({ order }));

  it("returns the catalogue ordered by key", async () => {
    order.mockResolvedValue({ data: [{ key: "a.b", description: "d" }], error: null });
    expect(await listPermissions()).toEqual({
      ok: true,
      value: [{ key: "a.b", description: "d" }],
    });
    expect(from).toHaveBeenCalledWith("permissions");
    expect(order).toHaveBeenCalledWith("key");
  });

  it("returns load_failed on error or exception", async () => {
    order.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listPermissions()).toMatchObject({ ok: false, error: "load_failed" });
    order.mockRejectedValue(new Error("network"));
    expect(await listPermissions()).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("listRolePermissions", () => {
  it("returns the links, and load_failed on failure", async () => {
    select.mockResolvedValue({ data: [{ role: "manager", permission: "a.b" }], error: null });
    expect(await listRolePermissions()).toEqual({
      ok: true,
      value: [{ role: "manager", permission: "a.b" }],
    });
    select.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listRolePermissions()).toMatchObject({ ok: false, error: "load_failed" });
    select.mockImplementation(() => {
      throw new Error("network");
    });
    expect(await listRolePermissions()).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("listUserOverrides", () => {
  beforeEach(() => select.mockReturnValue({ eq }));

  it("filters by user", async () => {
    eq.mockResolvedValue({ data: [{ permission: "a.b", effect: "deny" }], error: null });
    expect(await listUserOverrides("u1")).toEqual({
      ok: true,
      value: [{ permission: "a.b", effect: "deny" }],
    });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("returns load_failed on error or exception", async () => {
    eq.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listUserOverrides("u1")).toMatchObject({ ok: false, error: "load_failed" });
    eq.mockRejectedValue(new Error("network"));
    expect(await listUserOverrides("u1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});
