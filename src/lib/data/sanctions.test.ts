import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSanctions } from "./sanctions";

const limit = vi.fn();
const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ order });
  order.mockReturnValue({ limit });
});

describe("listSanctions", () => {
  it("returns the sanctions of the target, newest first", async () => {
    limit.mockResolvedValue({ data: [{ id: "s1" }], error: null });
    expect(await listSanctions("u1")).toEqual({ ok: true, value: [{ id: "s1" }] });
    expect(from).toHaveBeenCalledWith("moderation_actions");
    expect(eq).toHaveBeenCalledWith("target_id", "u1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns load_failed on error or exception", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listSanctions("u1")).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockRejectedValue(new Error("network"));
    expect(await listSanctions("u1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});
