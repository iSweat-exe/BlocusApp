import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
const deleteUser = vi.fn();
const recordSignupOrigin = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession, signOut } }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ auth: { admin: { deleteUser } } }),
}));

vi.mock("@/features/auth/signup-origin", () => ({
  recordSignupOrigin: (...args: unknown[]) => recordSignupOrigin(...args),
}));

const callback = (query: string) => new Request(`https://blocus.app/auth/callback?${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /auth/callback", () => {
  it("exchanges the code with the verifier of the flow named by sb_flow_id", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(callback("code=abc&sb_flow_id=flow12345678&next=/events"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc", { flowId: "flow12345678" });
    expect(response.headers.get("location")).toBe("https://blocus.app/events");
  });

  it("notes where a new account comes from, with the request headers", async () => {
    const user = {
      id: "u1",
      created_at: "2026-10-11T12:00:00Z",
      email: "a@example.test",
      email_confirmed_at: "2026-10-11T12:00:00Z",
    };
    exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null });

    const request = callback("code=abc");
    await GET(request);

    expect(recordSignupOrigin).toHaveBeenCalledWith(user, request.headers);
  });

  it("does not note anything when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: "x" } });

    await GET(callback("code=abc"));

    expect(recordSignupOrigin).not.toHaveBeenCalled();
  });

  it("falls back to the latest verifier when the callback carries no flow id", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: null });

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

  describe("e-mail not verified", () => {
    const fresh = () => new Date().toISOString();
    const unverified = (created_at: string) => ({
      id: "u1",
      created_at,
      email: "a@example.test",
      email_confirmed_at: null,
    });

    it("refuses a new account without a verified e-mail: signs out, removes it, explains", async () => {
      exchangeCodeForSession.mockResolvedValue({
        data: { user: unverified(fresh()) },
        error: null,
      });
      deleteUser.mockResolvedValue({ error: null });

      const response = await GET(callback("code=abc&next=/events"));

      expect(signOut).toHaveBeenCalled();
      expect(deleteUser).toHaveBeenCalledWith("u1");
      expect(recordSignupOrigin).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        "https://blocus.app/login?error=email_not_verified",
      );
    });

    it("signs an existing account out but never deletes it", async () => {
      exchangeCodeForSession.mockResolvedValue({
        data: { user: unverified("2024-01-01T00:00:00Z") },
        error: null,
      });

      const response = await GET(callback("code=abc"));

      expect(signOut).toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toContain("error=email_not_verified");
    });

    it("still refuses when the account cannot be removed", async () => {
      exchangeCodeForSession.mockResolvedValue({
        data: { user: unverified(fresh()) },
        error: null,
      });
      deleteUser.mockRejectedValue(new Error("boom"));

      const response = await GET(callback("code=abc"));

      expect(response.headers.get("location")).toContain("error=email_not_verified");
    });

    it("explains a provider that returned no e-mail at all", async () => {
      const response = await GET(
        callback(
          "error=server_error&error_description=Error+getting+user+email+from+external+provider",
        ),
      );

      expect(response.headers.get("location")).toBe(
        "https://blocus.app/login?error=email_not_verified",
      );
    });
  });
});
