import { describe, expect, it } from "vitest";
import { assuranceLevelOf, formatSecret, isValidCode, normalizeCode } from "./mfa";

describe("normalizeCode and isValidCode", () => {
  it("accepts six digits, with the spaces that apps display or people paste", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(isValidCode("123456")).toBe(true);
    expect(isValidCode("123 456")).toBe(true);
  });

  it.each(["", "12345", "1234567", "12345a", "١٢٣٤٥٦", null, undefined, 123456])(
    "refuses %j",
    (code) => {
      expect(isValidCode(code)).toBe(false);
    },
  );
});

describe("formatSecret", () => {
  it("groups the secret by four", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(formatSecret("ABCDEF")).toBe("ABCD EF");
    expect(formatSecret("")).toBe("");
  });
});

describe("assuranceLevelOf", () => {
  it("is aal2 only for an explicit aal2 claim", () => {
    expect(assuranceLevelOf("aal2")).toBe("aal2");
    expect(assuranceLevelOf("aal1")).toBe("aal1");
    expect(assuranceLevelOf(undefined)).toBe("aal1");
    expect(assuranceLevelOf("AAL2")).toBe("aal1");
  });
});
