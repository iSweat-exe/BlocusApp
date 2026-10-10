import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession } }),
}));

const callback = (query: string) => new Request(`https://blocus.app/auth/callback?${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /auth/callback", () => {
  it("exchanges the code with the verifier of the flow named by sb_flow_id", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(callback("code=abc&sb_flow_id=flow12345678&next=/events"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc", { flowId: "flow12345678" });
    expect(response.headers.get("location")).toBe("https://blocus.app/events");
  });

  it("falls back to the latest verifier when the callback carries no flow id", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    await GET(callback("code=abc"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc", undefined);
  });

  it("sends the user back to the login page when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { code: "bad_code_verifier", message: "x" },
    });

    const response = await GET(callback("code=abc"));

    expect(response.headers.get("location")).toBe("https://blocus.app/login?error=oauth_callback");
  });

  it("sends the user back to the login page without a code", async () => {
    const response = await GET(callback("error_description=denied"));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://blocus.app/login?error=oauth_callback");
  });
});
