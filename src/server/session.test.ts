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
      data: {
        claims: {
          sub: "u1",
          app_role: "manager",
          email: "a@b.c",
          app_metadata: { provider: "discord", providers: ["discord", "google"] },
          user_metadata: { avatar_url: "https://cdn.discordapp.com/avatars/1/a.png" },
          permissions: ["announcement.publish", 42],
        },
      },
    });
    expect(await getSessionPermissions()).toEqual({
      userId: "u1",
      role: "manager",
      permissions: ["announcement.publish"],
      email: "a@b.c",
      providers: ["discord", "google"],
      avatarUrl: "https://cdn.discordapp.com/avatars/1/a.png",
    });
  });

  it("falls back to the first provider when the list is missing", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1", app_metadata: { provider: "google" } } },
    });
    expect((await getSessionPermissions())?.providers).toEqual(["google"]);
  });

  it("treats missing or malformed permissions as none", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", permissions: "oops" } } });
    expect(await getSessionPermissions()).toEqual({
      userId: "u1",
      role: null,
      permissions: [],
      email: null,
      providers: [],
      avatarUrl: null,
    });
  });
});
