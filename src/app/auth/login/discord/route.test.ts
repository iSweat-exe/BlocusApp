import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const signInWithOAuth = vi.fn();
const resolveDiscordAuthorizeUrl = vi.fn();

vi.mock("@/features/auth/discord-url", () => ({
  resolveDiscordAuthorizeUrl: (...args: unknown[]) => resolveDiscordAuthorizeUrl(...args),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { signInWithOAuth } }) }));

const request = new Request("https://blocus.app/auth/login/discord");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blocus.app");
});

describe("GET /auth/login/discord", () => {
  it("redirects to the provider URL, asking for the callback route", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://x.supabase.co/auth/v1/authorize?provider=discord" },
      error: null,
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://x.supabase.co/auth/v1/authorize?provider=discord",
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "discord",
      options: { redirectTo: "https://blocus.app/auth/callback", skipBrowserRedirect: true },
    });
  });

  it("sends the user back to the login page on failure", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "boom" } });
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("https://blocus.app/login?error=oauth_start");
  });

  describe("?format=json", () => {
    const jsonRequest = new Request("https://blocus.app/auth/login/discord?format=json");
    const SUPABASE_URL = "https://x.supabase.co/auth/v1/authorize?provider=discord";

    it("returns the Discord URL itself when it can be resolved", async () => {
      signInWithOAuth.mockResolvedValue({ data: { url: SUPABASE_URL }, error: null });
      resolveDiscordAuthorizeUrl.mockResolvedValue(
        "https://discord.com/oauth2/authorize?client_id=1",
      );
      const response = await GET(jsonRequest);
      expect(await response.json()).toEqual({
        url: "https://discord.com/oauth2/authorize?client_id=1",
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(resolveDiscordAuthorizeUrl).toHaveBeenCalledWith(SUPABASE_URL);
    });

    it("falls back to the Supabase URL, and reports a start failure as JSON", async () => {
      signInWithOAuth.mockResolvedValue({ data: { url: SUPABASE_URL }, error: null });
      resolveDiscordAuthorizeUrl.mockResolvedValue(null);
      expect(await (await GET(jsonRequest)).json()).toEqual({ url: SUPABASE_URL });

      signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "boom" } });
      const failure = await GET(jsonRequest);
      expect(failure.status).toBe(502);
    });
  });
});
