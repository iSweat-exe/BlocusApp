import { describe, expect, it } from "vitest";
import { canAccessAdmin, hasAnyPermission } from "./access";
import { isSanctionActive, MAX_CUSTOM_DAYS, parseBanInput, REASON_MAX } from "./sanctions";

const NOW = new Date("2026-10-07T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

describe("parseBanInput", () => {
  it("computes preset expiries from the server clock", () => {
    const result = parseBanInput({ reason: " spam ", duration: "24h", customExpiresAt: "" }, NOW);
    expect(result).toEqual({
      ok: true,
      value: { reason: "spam", expiresAt: new Date(NOW.getTime() + 24 * HOUR) },
    });
    expect(parseBanInput({ reason: "x", duration: "7d", customExpiresAt: "" }, NOW)).toMatchObject({
      value: { expiresAt: new Date(NOW.getTime() + 7 * 24 * HOUR) },
    });
  });

  it("makes permanent bans without expiry", () => {
    expect(parseBanInput({ reason: "x", duration: "permanent", customExpiresAt: "" }, NOW)).toEqual(
      {
        ok: true,
        value: { reason: "x", expiresAt: null },
      },
    );
  });

  it("accepts a future custom date", () => {
    const iso = "2026-12-01T10:00:00.000Z";
    expect(parseBanInput({ reason: "x", duration: "custom", customExpiresAt: iso }, NOW)).toEqual({
      ok: true,
      value: { reason: "x", expiresAt: new Date(iso) },
    });
  });

  it.each([
    ["not a date", "Indique"],
    ["2026-10-01T00:00:00.000Z", "futur"],
    [new Date(NOW.getTime() + (MAX_CUSTOM_DAYS + 1) * 24 * HOUR).toISOString(), "Permanent"],
    [undefined, "Indique"],
  ])("rejects the custom date %j", (customExpiresAt, hint) => {
    const result = parseBanInput({ reason: "x", duration: "custom", customExpiresAt }, NOW);
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { duration: expect.stringContaining(hint) },
    });
  });

  it("requires a reason within the limit and a known duration", () => {
    expect(parseBanInput({ reason: "  ", duration: "1h", customExpiresAt: "" }, NOW)).toMatchObject(
      {
        ok: false,
        fieldErrors: { reason: expect.any(String) },
      },
    );
    expect(
      parseBanInput(
        { reason: "x".repeat(REASON_MAX + 1), duration: "1h", customExpiresAt: "" },
        NOW,
      ),
    ).toMatchObject({ ok: false, fieldErrors: { reason: expect.any(String) } });
    expect(
      parseBanInput({ reason: "x", duration: "forever", customExpiresAt: "" }, NOW),
    ).toMatchObject({
      ok: false,
      fieldErrors: { duration: expect.any(String) },
    });
  });
});

describe("isSanctionActive", () => {
  const base = { id: "1", kind: "ban", reason: "r", created_at: "2026-10-01T00:00:00Z" };
  it("is active until lifted or expired", () => {
    expect(isSanctionActive({ ...base, expires_at: null, revoked_at: null }, NOW)).toBe(true);
    expect(
      isSanctionActive({ ...base, expires_at: "2026-10-08T00:00:00Z", revoked_at: null }, NOW),
    ).toBe(true);
    expect(
      isSanctionActive({ ...base, expires_at: "2026-10-06T00:00:00Z", revoked_at: null }, NOW),
    ).toBe(false);
    expect(
      isSanctionActive({ ...base, expires_at: null, revoked_at: "2026-10-02T00:00:00Z" }, NOW),
    ).toBe(false);
  });
});

describe("admin access helpers", () => {
  it("opens the admin area with any admin permission", () => {
    expect(canAccessAdmin(["user.ban"])).toBe(true);
    expect(canAccessAdmin(["audit.read"])).toBe(true);
    expect(canAccessAdmin(["announcement.publish"])).toBe(false);
    expect(canAccessAdmin([])).toBe(false);
  });

  it("checks for any of the wanted permissions", () => {
    expect(hasAnyPermission(["a", "b"], ["c", "b"])).toBe(true);
    expect(hasAnyPermission(["a"], ["c"])).toBe(false);
  });
});
