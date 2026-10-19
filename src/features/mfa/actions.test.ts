import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmTotpEnrollment,
  disableTotp,
  setAdminMfaRequired,
  startTotpEnrollment,
  verifyTotpCode,
} from "./actions";

const getClaims = vi.fn();
const listFactors = vi.fn();
const enroll = vi.fn();
const unenroll = vi.fn();
const challenge = vi.fn();
const verify = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims, mfa: { listFactors, enroll, unenroll, challenge, verify } },
    rpc,
  }),
}));
vi.mock("@/server/log-action-error", () => ({ logActionError: vi.fn() }));

const FACTOR = "00000000-0000-0000-0000-00000000fa01";
const verifiedFactor = { id: FACTOR, factor_type: "totp", status: "verified" };
const pendingFactor = {
  id: "00000000-0000-0000-0000-00000000fa02",
  factor_type: "totp",
  status: "unverified",
};

function factors(all: object[]) {
  return {
    data: {
      all,
      totp: all.filter((factor) => (factor as { factor_type: string }).factor_type === "totp"),
    },
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  listFactors.mockResolvedValue(factors([]));
  enroll.mockResolvedValue({
    data: {
      id: FACTOR,
      totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "JBSWY3DPEHPK3PXP" },
    },
    error: null,
  });
  unenroll.mockResolvedValue({ error: null });
  challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
  verify.mockResolvedValue({ data: {}, error: null });
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("startTotpEnrollment", () => {
  it("returns the QR code and the secret of a new authenticator", async () => {
    await expect(startTotpEnrollment()).resolves.toEqual({
      ok: true,
      factorId: FACTOR,
      qrCode: "data:image/svg+xml;utf8,<svg/>",
      secret: "JBSWY3DPEHPK3PXP",
    });
    expect(enroll).toHaveBeenCalledWith(
      expect.objectContaining({ factorType: "totp", issuer: "BLOCUS" }),
    );
  });

  it("removes an abandoned attempt first, so unverified factors do not pile up", async () => {
    listFactors.mockResolvedValue(factors([pendingFactor]));
    await startTotpEnrollment();
    expect(unenroll).toHaveBeenCalledWith({ factorId: pendingFactor.id });
  });

  it("refuses when an authenticator is already verified", async () => {
    listFactors.mockResolvedValue(factors([verifiedFactor]));
    await expect(startTotpEnrollment()).resolves.toMatchObject({ ok: false });
    expect(enroll).not.toHaveBeenCalled();
  });

  it("refuses a Guest", async () => {
    getClaims.mockResolvedValue({ data: null });
    await expect(startTotpEnrollment()).resolves.toMatchObject({ ok: false });
    expect(enroll).not.toHaveBeenCalled();
  });

  it("says when the Auth server has TOTP turned off", async () => {
    enroll.mockResolvedValue({
      data: null,
      error: { code: "mfa_totp_enroll_not_enabled", message: "off" },
    });
    await expect(startTotpEnrollment()).resolves.toEqual({
      ok: false,
      message: "La double authentification n'est pas activée sur le serveur d'authentification.",
    });
  });
});

describe("confirmTotpEnrollment", () => {
  it("challenges, then verifies with the normalized code", async () => {
    await expect(confirmTotpEnrollment(FACTOR, "123 456")).resolves.toEqual({ ok: true });
    expect(challenge).toHaveBeenCalledWith({ factorId: FACTOR });
    expect(verify).toHaveBeenCalledWith({
      factorId: FACTOR,
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("refuses an invalid id or code without calling Auth", async () => {
    expect((await confirmTotpEnrollment("nope", "123456")).ok).toBe(false);
    expect((await confirmTotpEnrollment(FACTOR, "12")).ok).toBe(false);
    expect(challenge).not.toHaveBeenCalled();
  });

  it("explains a wrong code", async () => {
    verify.mockResolvedValue({
      data: null,
      error: { code: "mfa_verification_failed", message: "bad" },
    });
    await expect(confirmTotpEnrollment(FACTOR, "123456")).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("Code incorrect"),
    });
  });
});

describe("verifyTotpCode", () => {
  it("verifies against the person's verified authenticator", async () => {
    listFactors.mockResolvedValue(factors([pendingFactor, verifiedFactor]));
    await expect(verifyTotpCode("654321")).resolves.toEqual({ ok: true });
    expect(challenge).toHaveBeenCalledWith({ factorId: FACTOR });
  });

  it("says when there is no authenticator, and refuses a malformed code", async () => {
    await expect(verifyTotpCode("654321")).resolves.toMatchObject({ ok: false });
    expect((await verifyTotpCode("abc")).ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("tells the person to wait after too many tries", async () => {
    listFactors.mockResolvedValue(factors([verifiedFactor]));
    challenge.mockResolvedValue({
      data: null,
      error: { code: "over_request_rate_limit", message: "slow", status: 429 },
    });
    await expect(verifyTotpCode("654321")).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("Trop d'essais"),
    });
  });
});

describe("disableTotp", () => {
  it("needs the current code, then removes every authenticator", async () => {
    listFactors.mockResolvedValue(factors([verifiedFactor, pendingFactor]));
    await expect(disableTotp("123456")).resolves.toEqual({ ok: true });
    expect(verify).toHaveBeenCalled();
    expect(unenroll).toHaveBeenCalledTimes(2);
  });

  it("removes nothing when the code is wrong", async () => {
    listFactors.mockResolvedValue(factors([verifiedFactor]));
    verify.mockResolvedValue({
      data: null,
      error: { code: "mfa_verification_failed", message: "bad" },
    });
    await expect(disableTotp("123456")).resolves.toMatchObject({ ok: false });
    expect(unenroll).not.toHaveBeenCalled();
  });
});

describe("setAdminMfaRequired", () => {
  it("calls the database function", async () => {
    await expect(setAdminMfaRequired(true)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_admin_mfa_required", { p_required: true });
  });

  it("refuses anything that is not a boolean", async () => {
    expect((await setAdminMfaRequired("true")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["mfa_required", "42501", "Valide d'abord ton code de double authentification."],
    ["forbidden", "42501", "Seul un super administrateur peut changer ce réglage."],
    ["boom", "XX000", "L'opération a échoué. Réessaie."],
  ])("explains a refusal (%s)", async (message, code, shown) => {
    rpc.mockResolvedValue({ data: null, error: { message, code } });
    await expect(setAdminMfaRequired(false)).resolves.toEqual({ ok: false, message: shown });
  });
});
