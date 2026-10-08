import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const limit = vi.fn();
const select = vi.fn();
const from = vi.fn();
const recordCronSnapshot = vi.fn();
vi.mock("@/features/health/cron-snapshot", () => ({
  recordCronSnapshot: () => recordCronSnapshot(),
}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from }) }));

const request = (headers: Record<string, string> = {}) =>
  new Request("https://blocus.app/api/keep-alive", { headers });

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ limit });
  limit.mockResolvedValue({ data: [], error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/keep-alive", () => {
  it("touches the database with one tiny read and answers ok", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(from).toHaveBeenCalledWith("events");
    expect(select).toHaveBeenCalledWith("id");
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("also records a health snapshot once the database answered", async () => {
    await GET(request());
    expect(recordCronSnapshot).toHaveBeenCalledOnce();
  });

  it("answers 503 when the database cannot be reached", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await GET(request())).status).toBe(503);
    limit.mockRejectedValue(new Error("network"));
    expect((await GET(request())).status).toBe(503);
    expect(recordCronSnapshot).not.toHaveBeenCalled();
  });

  it("requires the cron secret when one is configured, and does not touch the database without it", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request({ authorization: "Bearer wrong" }))).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
    expect((await GET(request({ authorization: "Bearer s3cret" }))).status).toBe(200);
  });
});
