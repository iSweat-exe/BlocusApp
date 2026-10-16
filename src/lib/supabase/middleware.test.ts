import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVITY_COOKIE_NAME, activityMark, activityStamp } from "./activity";

const getClaims = vi.fn();
const refreshSession = vi.fn();
const rpc = vi.fn();
const touchActivity = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims, refreshSession }, rpc: touchActivity }),
}));
vi.mock("./public", () => ({ createPublicClient: () => ({ rpc }) }));

const EPOCH = "2026-10-08T10:00:00.000Z";
const before = Date.parse("2026-10-08T09:00:00Z") / 1000;
const after = Date.parse("2026-10-08T11:00:00Z") / 1000;

// The module keeps per-instance state (epoch memo, refreshed users): load a fresh copy for every test.
async function run() {
  vi.resetModules();
  const { updateSession } = await import("./middleware");
  return (cookie?: string, defer?: (work: Promise<unknown>) => void) =>
    updateSession(
      new NextRequest("http://localhost/", cookie ? { headers: { cookie } } : undefined),
      defer,
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: EPOCH, error: null });
  refreshSession.mockResolvedValue({ data: {}, error: null });
  touchActivity.mockResolvedValue({ data: null, error: null });
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

describe("updateSession: activity report", () => {
  const signedIn = () =>
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", iat: after } } });

  it("reports a signed-in user as active and remembers the hour in a cookie", async () => {
    signedIn();
    const deferred: Promise<unknown>[] = [];
    const request = await run();

    const response = await request(undefined, (work) => deferred.push(work));

    expect(touchActivity).toHaveBeenCalledWith("touch_activity");
    expect(deferred).toHaveLength(1);
    expect(response.cookies.get(ACTIVITY_COOKIE_NAME)?.value).toBe(activityMark("u1"));
  });

  it("reports once per interval: a browser that already did gets no new call", async () => {
    signedIn();
    const request = await run();

    const response = await request(`${ACTIVITY_COOKIE_NAME}=${activityMark("u1")}`);

    expect(touchActivity).not.toHaveBeenCalled();
    expect(response.cookies.get(ACTIVITY_COOKIE_NAME)).toBeUndefined();
  });

  it("reports again when the cookie is from an earlier hour", async () => {
    signedIn();
    const request = await run();

    await request(`${ACTIVITY_COOKIE_NAME}=${Number(activityStamp()) - 1}:u1`);

    expect(touchActivity).toHaveBeenCalledTimes(1);
  });

  it("reports again for another user on the same browser within the hour", async () => {
    signedIn();
    const request = await run();

    await request(`${ACTIVITY_COOKIE_NAME}=${activityMark("someone-else")}`);

    expect(touchActivity).toHaveBeenCalledTimes(1);
  });

  it("ignores Guests", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const request = await run();

    const response = await request();

    expect(touchActivity).not.toHaveBeenCalled();
    expect(response.cookies.get(ACTIVITY_COOKIE_NAME)).toBeUndefined();
  });

  it("never breaks the page when the report fails", async () => {
    signedIn();
    touchActivity.mockRejectedValue(new Error("network"));
    const deferred: Promise<unknown>[] = [];
    const request = await run();

    await expect(request(undefined, (work) => deferred.push(work))).resolves.toBeDefined();
    await expect(Promise.all(deferred)).resolves.toBeDefined();
  });
});
