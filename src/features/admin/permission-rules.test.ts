import { describe, expect, it } from "vitest";
import {
  canEditRolePermission,
  canGrantOverride,
  effectiveState,
  permissionLabel,
  toOverride,
} from "./permission-rules";

describe("permissionLabel", () => {
  it("uses the French label, then the description, then the key", () => {
    expect(permissionLabel("user.ban", "Ban a user")).toBe("Bannir un utilisateur");
    expect(permissionLabel("future.thing", "A future thing")).toBe("A future thing");
    expect(permissionLabel("future.thing")).toBe("future.thing");
  });
});

describe("toOverride", () => {
  it("keeps known effects and drops anything else", () => {
    expect(toOverride("grant")).toBe("grant");
    expect(toOverride("deny")).toBe("deny");
    expect(toOverride("maybe")).toBeNull();
    expect(toOverride(null)).toBeNull();
    expect(toOverride(undefined)).toBeNull();
  });
});

describe("effectiveState", () => {
  it("lets a deny win over the role, and a grant add to it", () => {
    expect(effectiveState(true, "deny")).toEqual({ allowed: false, source: "deny" });
    expect(effectiveState(false, "grant")).toEqual({ allowed: true, source: "grant" });
    expect(effectiveState(true, null)).toEqual({ allowed: true, source: "role" });
    expect(effectiveState(false, null)).toEqual({ allowed: false, source: "none" });
  });
});

describe("canEditRolePermission", () => {
  const base = { callerRank: 40, roleRank: 30, currentlyGranted: false, callerHolds: true };

  it("allows lower roles, and grants only what the caller holds", () => {
    expect(canEditRolePermission(base)).toBe(true);
    expect(canEditRolePermission({ ...base, callerHolds: false })).toBe(false);
  });

  it("always allows revoking from a lower role, even a permission the caller lacks", () => {
    expect(canEditRolePermission({ ...base, currentlyGranted: true, callerHolds: false })).toBe(
      true,
    );
  });

  it("refuses equal or higher roles and unknown callers", () => {
    expect(canEditRolePermission({ ...base, roleRank: 40 })).toBe(false);
    expect(canEditRolePermission({ ...base, roleRank: 100 })).toBe(false);
    expect(canEditRolePermission({ ...base, callerRank: undefined })).toBe(false);
  });
});

describe("canGrantOverride", () => {
  it("requires holding the permission", () => {
    expect(canGrantOverride(true)).toBe(true);
    expect(canGrantOverride(false)).toBe(false);
  });
});
