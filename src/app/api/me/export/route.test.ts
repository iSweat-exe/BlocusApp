import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const rpc = vi.fn();

vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));
vi.mock("@/server/log-action-error", () => ({ logActionError: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("GET /api/me/export", () => {
  it("sends the document of the database function as a downloaded, never cached JSON file", async () => {
    rpc.mockResolvedValue({ data: { account: { email: "a@b.c" } }, error: null });
    const response = await GET();

    expect(rpc).toHaveBeenCalledWith("export_my_data");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="blocus-mes-donnees-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(JSON.parse(await response.text())).toEqual({ account: { email: "a@b.c" } });
  });

  it("answers 401 to a Guest, with nothing in the body", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "unauthenticated" });
  });

  it("answers 500 without leaking the database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "relation secret" } });
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
