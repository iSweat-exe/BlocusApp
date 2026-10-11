import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSignupOrigin } from "./signup-origins";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSignupOrigin", () => {
  it("reads the origin of one user", async () => {
    maybeSingle.mockResolvedValue({
      data: { country: "FR", region: "ARA", city: "Lyon" },
      error: null,
    });

    expect(await getSignupOrigin("u1")).toEqual({
      ok: true,
      value: { country: "FR", region: "ARA", city: "Lyon" },
    });
    expect(from).toHaveBeenCalledWith("signup_origins");
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("returns null when there is no row (not recorded, or hidden by RLS)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getSignupOrigin("u1")).toEqual({ ok: true, value: null });
  });

  it("reports a failed read", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getSignupOrigin("u1")).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("reports a thrown error", async () => {
    maybeSingle.mockRejectedValue(new Error("network"));
    expect(await getSignupOrigin("u1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});
