import { describe, expect, it } from "vitest";
import { BODY_MAX, TITLE_MAX, validateAnnouncementInput } from "./schema";

describe("validateAnnouncementInput", () => {
  it("trims and accepts valid input", () => {
    expect(
      validateAnnouncementInput({ title: "  Départ 14h ", body: " Place centrale. " }),
    ).toEqual({
      ok: true,
      value: { title: "Départ 14h", body: "Place centrale." },
    });
  });

  it.each([undefined, null, 42, "", "   "])(
    "rejects an empty or non-string title (%j)",
    (title) => {
      const result = validateAnnouncementInput({ title, body: "ok" });
      expect(result).toMatchObject({ ok: false, fieldErrors: { title: expect.any(String) } });
    },
  );

  it("rejects an empty body", () => {
    expect(validateAnnouncementInput({ title: "t", body: " " })).toMatchObject({
      ok: false,
      fieldErrors: { body: expect.any(String) },
    });
  });

  it("enforces the maximum lengths", () => {
    const tooLong = validateAnnouncementInput({
      title: "x".repeat(TITLE_MAX + 1),
      body: "y".repeat(BODY_MAX + 1),
    });
    expect(tooLong).toMatchObject({
      ok: false,
      fieldErrors: { title: expect.any(String), body: expect.any(String) },
    });
    expect(
      validateAnnouncementInput({ title: "x".repeat(TITLE_MAX), body: "y".repeat(BODY_MAX) }).ok,
    ).toBe(true);
  });
});
