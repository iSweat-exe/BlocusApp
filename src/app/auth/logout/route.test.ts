import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const signOut = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { signOut } }) }));

beforeEach(() => signOut.mockReset().mockResolvedValue({ error: null }));

describe("POST /auth/logout", () => {
  it("ends the session and redirects to the login page with a 303", async () => {
    const response = await POST(new Request("https://blocus.app/auth/logout", { method: "POST" }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://blocus.app/login");
  });
});
