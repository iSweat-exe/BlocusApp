import { describe, expect, it } from "vitest";
import { roleDescription } from "./role-descriptions";

/** Every role created by the migrations, in rank order. */
const ROLES = [
  "user",
  "relay",
  "editor",
  "manager",
  "moderator",
  "developer",
  "admin",
  "super_admin",
];

describe("roleDescription", () => {
  it("describes every role of the hierarchy, each one differently", () => {
    const texts = ROLES.map((role) => roleDescription(role));
    for (const text of texts) {
      expect(text).toEqual(expect.any(String));
      expect(text!.length).toBeGreaterThan(10);
    }
    expect(new Set(texts).size).toBe(ROLES.length);
  });

  it("has nothing to say about a role this version does not know", () => {
    expect(roleDescription("something_new")).toBeNull();
    expect(roleDescription("")).toBeNull();
  });
});
