import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLastSeen } from "./last-seen";

const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLastSeen", () => {
  it("reads when one user was last seen", async () => {
    rpc.mockResolvedValue({ data: "2026-10-16T08:00:00Z", error: null });

    expect(await getLastSeen("u1")).toEqual({ ok: true, value: "2026-10-16T08:00:00Z" });
    expect(rpc).toHaveBeenCalledWith("get_last_seen", { p_user_id: "u1" });
  });

  it("returns null for a user never seen", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getLastSeen("u1")).toEqual({ ok: true, value: null });
  });

  it("reports a refused or failed read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect(await getLastSeen("u1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});
