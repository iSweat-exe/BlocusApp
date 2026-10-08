import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const refreshSession = vi.fn();
const rpc = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims, refreshSession } }),
}));
vi.mock("./public", () => ({ createPublicClient: () => ({ rpc }) }));

const EPOCH = "2026-10-08T10:00:00.000Z";
const before = Date.parse("2026-10-08T09:00:00Z") / 1000;
const after = Date.parse("2026-10-08T11:00:00Z") / 1000;

// The module keeps per-instance state (epoch memo, refreshed users): load a fresh copy for every test.
async function run() {
  vi.resetModules();
  const { updateSession } = await import("./middleware");
  return () => updateSession(new NextRequest("http://localhost/"));
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: EPOCH, error: null });
  refreshSession.mockResolvedValue({ data: {}, error: null });
});

describe("updateSession", () => {
  it("re-issues the token of a signed-in user whose permissions changed after it was issued", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", iat: before } } });
    const request = await run();
    await request();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("does not loop: the same user is not refreshed twice for the same change", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", iat: before } } });
    const request = await run();
    await request();
    await request();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("leaves a token issued after the change alone", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", iat: after } } });
    const request = await run();
    await request();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("does nothing for Guests and does not even read the epoch", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const request = await run();
    await request();
    expect(rpc).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("never breaks the page when the epoch cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", iat: before } } });
    const request = await run();
    await expect(request()).resolves.toBeDefined();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("reads the epoch only once for many requests", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", iat: after } } });
    const request = await run();
    await request();
    await request();
    await request();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
