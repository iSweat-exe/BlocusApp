import { describe, expect, it } from "vitest";
import { hasVerifiedEmail, isMissingEmailError } from "./email-verification";

const verified = { email: "a@example.test", email_confirmed_at: "2026-10-15T10:00:00Z" };

describe("hasVerifiedEmail", () => {
  it("accepts an address confirmed by the provider", () => {
    expect(hasVerifiedEmail(verified)).toBe(true);
    expect(
      hasVerifiedEmail({ ...verified, identities: [{ identity_data: { email_verified: true } }] }),
    ).toBe(true);
  });

  it.each([
    ["no user", null],
    ["no address", { ...verified, email: null }],
    ["an empty address", { ...verified, email: "" }],
    ["an address Supabase did not confirm", { ...verified, email_confirmed_at: null }],
    [
      "an identity that reports the address as unverified",
      { ...verified, identities: [{ identity_data: { email_verified: false } }] },
    ],
  ])("refuses %s", (_label, user) => {
    expect(hasVerifiedEmail(user)).toBe(false);
  });
});

describe("isMissingEmailError", () => {
  it("recognises the Supabase message for a provider that gave no e-mail", () => {
    expect(isMissingEmailError("Error getting user email from external provider")).toBe(true);
  });

  it("ignores other errors and a missing description", () => {
    expect(isMissingEmailError("access_denied")).toBe(false);
    expect(isMissingEmailError(null)).toBe(false);
  });
});
