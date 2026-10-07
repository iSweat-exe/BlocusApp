import { describe, expect, it } from "vitest";
import { assignableRoles, canManageUser, rankOf, type RoleInfo } from "./hierarchy";

const ROLES: RoleInfo[] = [
  { key: "admin", label: "Administrateur", rank: 40 },
  { key: "user", label: "Utilisateur", rank: 10 },
  { key: "moderator", label: "Modérateur", rank: 30 },
  { key: "super_admin", label: "Super administrateur", rank: 100 },
  { key: "manager", label: "Gérant", rank: 20 },
];

describe("hierarchy helpers", () => {
  it("finds the rank of a role", () => {
    expect(rankOf(ROLES, "admin")).toBe(40);
    expect(rankOf(ROLES, "wizard")).toBeUndefined();
    expect(rankOf(ROLES, null)).toBeUndefined();
  });

  it("only lets you manage users ranking strictly below you, never yourself", () => {
    expect(canManageUser(40, 30, false)).toBe(true);
    expect(canManageUser(40, 40, false)).toBe(false);
    expect(canManageUser(40, 100, false)).toBe(false);
    expect(canManageUser(40, 10, true)).toBe(false);
    expect(canManageUser(undefined, 10, false)).toBe(false);
    expect(canManageUser(40, undefined, false)).toBe(false);
  });

  it("offers only roles below the caller, lowest first", () => {
    expect(assignableRoles(ROLES, 40).map((role) => role.key)).toEqual([
      "user",
      "manager",
      "moderator",
    ]);
    expect(assignableRoles(ROLES, 100).map((role) => role.key)).toEqual([
      "user",
      "manager",
      "moderator",
      "admin",
    ]);
    expect(assignableRoles(ROLES, undefined)).toEqual([]);
  });
});
