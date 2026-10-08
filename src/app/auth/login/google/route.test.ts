import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const signInWithOAuth = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { signInWithOAuth } }) }));

const request = new Request("https://blocus.app/auth/login/google");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blocus.app");
});

describe("GET /auth/login/google", () => {
  it("redirects to the provider URL, asking for the callback route", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://x.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://x.supabase.co/auth/v1/authorize?provider=google",
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://blocus.app/auth/callback", skipBrowserRedirect: true },
    });
  });

  it("sends the user back to the login page on failure", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "boom" } });
    const response = await GET(request);
    expect(response.headers.get("location")).toBe("https://blocus.app/login?error=oauth_start");
  });
});
