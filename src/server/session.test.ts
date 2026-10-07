import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionPermissions } from "./session";

const getClaims = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { getClaims } }) }));

beforeEach(() => getClaims.mockReset());

describe("getSessionPermissions", () => {
  it("returns null for a Guest", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect(await getSessionPermissions()).toBeNull();
  });

  it("returns the user id and string permissions from the claims", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1", permissions: ["announcement.publish", 42] } },
    });
    expect(await getSessionPermissions()).toEqual({
      userId: "u1",
      permissions: ["announcement.publish"],
    });
  });

  it("treats missing or malformed permissions as none", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", permissions: "oops" } } });
    expect(await getSessionPermissions()).toEqual({ userId: "u1", permissions: [] });
  });
});
