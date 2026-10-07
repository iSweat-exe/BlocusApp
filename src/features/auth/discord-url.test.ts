import { describe, expect, it, vi } from "vitest";
import { resolveDiscordAuthorizeUrl, toDiscordAppUrl } from "./discord-url";

describe("toDiscordAppUrl", () => {
  it("drops the /api prefix and keeps the query", () => {
    expect(
      toDiscordAppUrl(
        "https://discord.com/api/oauth2/authorize?client_id=1&state=abc&scope=identify",
      ),
    ).toBe("https://discord.com/oauth2/authorize?client_id=1&state=abc&scope=identify");
  });

  it("keeps an already plain authorize URL", () => {
    expect(toDiscordAppUrl("https://discord.com/oauth2/authorize?client_id=1")).toBe(
      "https://discord.com/oauth2/authorize?client_id=1",
    );
  });

  it.each([
    null,
    "",
    "not a url",
    "https://evil.example/oauth2/authorize?client_id=1",
    "https://discord.com.evil.example/oauth2/authorize",
    "http://discord.com/oauth2/authorize",
    "https://discord.com/api/v10/oauth2/authorize?client_id=1",
    "https://discord.com/login",
  ])("refuses %j", (value) => {
    expect(toDiscordAppUrl(value)).toBeNull();
  });
});

describe("resolveDiscordAuthorizeUrl", () => {
  const redirect = (location: string | null) =>
    vi.fn(async () => new Response(null, { status: 302, headers: location ? { location } : {} }));

  it("reads the redirect without following it", async () => {
    const fetchImpl = redirect("https://discord.com/api/oauth2/authorize?client_id=1");
    expect(
      await resolveDiscordAuthorizeUrl("https://x.supabase.co/auth/v1/authorize", fetchImpl),
    ).toBe("https://discord.com/oauth2/authorize?client_id=1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://x.supabase.co/auth/v1/authorize",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("returns null when there is no usable redirect or the request fails", async () => {
    expect(await resolveDiscordAuthorizeUrl("https://x", redirect(null))).toBeNull();
    expect(
      await resolveDiscordAuthorizeUrl("https://x", redirect("https://evil.example/")),
    ).toBeNull();
    const failing = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await resolveDiscordAuthorizeUrl("https://x", failing)).toBeNull();
  });
});
