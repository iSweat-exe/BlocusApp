import { beforeEach, describe, expect, it, vi } from "vitest";

const pingDatabase = vi.fn();
const pingAuth = vi.fn();
vi.mock("@/lib/data/health", () => ({
  pingDatabase: () => pingDatabase(),
  pingAuth: () => pingAuth(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function get() {
  const { GET } = await import("./route");
  return GET();
}

describe("GET /api/health", () => {
  it("answers 200 ok when the database and Auth are fast", async () => {
    pingDatabase.mockResolvedValue(50);
    pingAuth.mockResolvedValue(60);
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 200 degraded when a service is slow", async () => {
    pingDatabase.mockResolvedValue(600);
    pingAuth.mockResolvedValue(800);
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "degraded" });
  });

  it("answers 503 down when the database does not answer", async () => {
    pingDatabase.mockResolvedValue(null);
    pingAuth.mockResolvedValue(60);
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "down" });
  });

  it("reuses the answer for 10 seconds", async () => {
    vi.useFakeTimers();
    pingDatabase.mockResolvedValue(50);
    pingAuth.mockResolvedValue(60);
    const { GET } = await import("./route");

    await GET();
    await GET();
    expect(pingDatabase).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(11_000);
    await GET();
    expect(pingDatabase).toHaveBeenCalledTimes(2);
  });
});
