import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordSignupOrigin, signupOriginFromHeaders } from "./signup-origin";

const rpc = vi.fn();
const createServiceClient = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createServiceClient(),
}));

const headers = (values: Record<string, string>) => new Headers(values);
const lyon = headers({
  "x-vercel-ip-country": "FR",
  "x-vercel-ip-country-region": "ARA",
  "x-vercel-ip-city": "Lyon",
});

describe("signupOriginFromHeaders", () => {
  it("reads the country, the region and the city", () => {
    expect(signupOriginFromHeaders(lyon)).toEqual({ country: "FR", region: "ARA", city: "Lyon" });
  });

  it("decodes the URL-encoded city", () => {
    const origin = signupOriginFromHeaders(
      headers({ "x-vercel-ip-country": "BR", "x-vercel-ip-city": "S%C3%A3o%20Paulo" }),
    );
    expect(origin).toEqual({ country: "BR", region: null, city: "São Paulo" });
  });

  it("upper-cases the country and keeps what is usable when the rest is missing", () => {
    expect(signupOriginFromHeaders(headers({ "x-vercel-ip-country": "be" }))).toEqual({
      country: "BE",
      region: null,
      city: null,
    });
  });

  it("returns null outside Vercel, where no header is set", () => {
    expect(signupOriginFromHeaders(headers({}))).toBeNull();
  });

  it("ignores a country that is not a two-letter code", () => {
    expect(signupOriginFromHeaders(headers({ "x-vercel-ip-country": "FRA" }))).toBeNull();
    expect(signupOriginFromHeaders(headers({ "x-vercel-ip-country": "1X" }))).toBeNull();
  });

  it("ignores a city that is not valid URL encoding or is too long", () => {
    expect(signupOriginFromHeaders(headers({ "x-vercel-ip-city": "%E0%A4%A" }))).toBeNull();
    expect(signupOriginFromHeaders(headers({ "x-vercel-ip-city": "a".repeat(97) }))).toBeNull();
  });

  it("strips control characters", () => {
    const origin = signupOriginFromHeaders(headers({ "x-vercel-ip-city": "Paris%0D%0A" }));
    expect(origin?.city).toBe("Paris");
  });
});

describe("recordSignupOrigin", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const user = (secondsAgo: number) => ({
    id: "user-1",
    created_at: new Date(now - secondsAgo * 1000).toISOString(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    rpc.mockResolvedValue({ data: true, error: null });
    createServiceClient.mockReturnValue({ rpc });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the origin of an account created a few seconds ago", async () => {
    await recordSignupOrigin(user(5), lyon);

    expect(rpc).toHaveBeenCalledWith("record_signup_origin", {
      p_user_id: "user-1",
      p_country: "FR",
      p_region: "ARA",
      p_city: "Lyon",
    });
  });

  it("leaves a returning user alone", async () => {
    await recordSignupOrigin(user(3600), lyon);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("does nothing without a user or without a location", async () => {
    await recordSignupOrigin(null, lyon);
    await recordSignupOrigin(user(5), headers({}));
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("never throws, whether the call fails or the service key is missing", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } });
    await expect(recordSignupOrigin(user(5), lyon)).resolves.toBeUndefined();

    createServiceClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    });
    await expect(recordSignupOrigin(user(5), lyon)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("keeps the location out of the logs", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "check failed" } });
    await recordSignupOrigin(user(5), lyon);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Lyon");
  });
});
