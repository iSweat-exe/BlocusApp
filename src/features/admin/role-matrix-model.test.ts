import { describe, expect, it } from "vitest";
import type { RoleInfo } from "./hierarchy";
import { groupPermissions } from "./permission-groups";
import { buildRoleMatrixModel, defaultRoleKey } from "./role-matrix-model";

const ROLES: RoleInfo[] = [
  { key: "user", label: "Utilisateur", rank: 10 },
  { key: "manager", label: "Gérant", rank: 20 },
  { key: "moderator", label: "Modérateur", rank: 30 },
  { key: "admin", label: "Administrateur", rank: 40 },
  { key: "super_admin", label: "Super administrateur", rank: 100 },
];

const PERMISSIONS = [
  { key: "announcement.publish" },
  { key: "event.create" },
  { key: "user.ban" },
  { key: "permission.manage" },
];

const HELD = new Set([
  "moderator:announcement.publish",
  "moderator:user.ban",
  "admin:event.create",
]);

function build(
  overrides: Partial<Parameters<typeof buildRoleMatrixModel>[0]> & {
    callerRole?: string;
    callerPermissions?: string[];
  } = {},
) {
  return buildRoleMatrixModel({
    roles: ROLES,
    permissions: PERMISSIONS,
    held: HELD,
    caller: {
      role: overrides.callerRole ?? "admin",
      permissions: overrides.callerPermissions ?? ["announcement.publish", "permission.manage"],
    },
    requestedRole: overrides.requestedRole,
  });
}

describe("groupPermissions", () => {
  it("groups by key prefix, in display order, and leaves empty groups out", () => {
    const groups = groupPermissions([
      { key: "permission.manage" },
      { key: "event.create" },
      { key: "announcement.delete" },
      { key: "announcement.publish" },
      { key: "role.assign" },
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Annonces",
      "Calendrier",
      "Administration",
    ]);
    expect(groups[0]?.items.map((item) => item.key)).toEqual([
      "announcement.delete",
      "announcement.publish",
    ]);
    expect(groups[2]?.items.map((item) => item.key)).toEqual(["permission.manage", "role.assign"]);
  });

  it("puts an unknown prefix in a last group instead of dropping it", () => {
    const groups = groupPermissions([{ key: "announcement.publish" }, { key: "billing.read" }]);
    expect(groups.at(-1)).toMatchObject({ id: "other", label: "Autres" });
    expect(groups.at(-1)?.items).toEqual([{ key: "billing.read" }]);
  });
});

describe("defaultRoleKey", () => {
  it("is the highest role below the caller's", () => {
    expect(defaultRoleKey(ROLES, 40)).toBe("moderator");
    expect(defaultRoleKey(ROLES, 100)).toBe("admin");
  });

  it("falls back to the caller's own role when nothing ranks below, then to the highest role", () => {
    expect(defaultRoleKey(ROLES, 10)).toBe("user");
    expect(defaultRoleKey(ROLES, undefined)).toBe("super_admin");
    expect(defaultRoleKey([], 40)).toBeNull();
  });
});

describe("buildRoleMatrixModel", () => {
  it("lists the roles highest first, with how many permissions each one holds", () => {
    const model = build();
    expect(model?.roles.map((role) => [role.key, role.grantedCount])).toEqual([
      ["super_admin", 4],
      ["admin", 1],
      ["moderator", 2],
      ["manager", 0],
      ["user", 0],
    ]);
  });

  it("describes the role it shows, and says nothing about a role it does not know", () => {
    expect(build({ requestedRole: "moderator" })?.selected.description).toMatch(/gérants/);
    const roles = [...ROLES, { key: "something_new", label: "Nouveau", rank: 50 }];
    const model = buildRoleMatrixModel({
      roles,
      permissions: PERMISSIONS,
      held: HELD,
      caller: { role: "super_admin", permissions: [] },
      requestedRole: "something_new",
    });
    expect(model?.selected.description).toBeNull();
  });

  it("opens the role asked for, or the default one when it is unknown", () => {
    expect(build({ requestedRole: "manager" })?.selected.key).toBe("manager");
    expect(build({ requestedRole: "nope" })?.selected.key).toBe("moderator");
    expect(build()?.selected.key).toBe("moderator");
  });

  it("lets a role below the caller be edited, and only grants what the caller holds", () => {
    const model = build({ requestedRole: "manager" });
    expect(model?.selected.status).toBe("editable");
    const rows = model?.selected.sections.flatMap((section) => section.rows) ?? [];
    const publish = rows.find((row) => row.key === "announcement.publish");
    const ban = rows.find((row) => row.key === "user.ban");
    expect(publish).toMatchObject({ granted: false, editable: true });
    expect(ban).toMatchObject({ granted: false, editable: false });
    expect(ban?.hint).toMatch(/ne possèdes pas/);
    expect(publish?.hint).toBeUndefined();
  });

  it("always lets the caller take a permission away from a lower role, even one they do not hold", () => {
    const model = build({ requestedRole: "moderator" });
    const ban = model?.selected.sections
      .flatMap((section) => section.rows)
      .find((row) => row.key === "user.ban");
    expect(ban).toMatchObject({ granted: true, editable: true });
    expect(ban?.hint).toBeUndefined();
  });

  it("shows a role at the caller's level or above read-only, without a hint on each row", () => {
    for (const key of ["admin", "super_admin"]) {
      const model = build({ requestedRole: key });
      const rows = model?.selected.sections.flatMap((section) => section.rows) ?? [];
      expect(rows.every((row) => !row.editable && row.hint === undefined)).toBe(true);
    }
    expect(build({ requestedRole: "admin" })?.selected.status).toBe("readonly");
  });

  it("locks the super administrator, who holds everything", () => {
    const model = build({ requestedRole: "super_admin", callerRole: "super_admin" });
    expect(model?.selected).toMatchObject({ status: "locked", grantedCount: 4, total: 4 });
    expect(model?.selected.note).toMatch(/non modifiable/);
  });

  it("counts the granted permissions per group", () => {
    const model = build({ requestedRole: "moderator" });
    const counts = Object.fromEntries(
      (model?.selected.sections ?? []).map((section) => [section.id, section.grantedCount]),
    );
    expect(counts).toEqual({ announcement: 1, calendar: 0, moderation: 1, administration: 0 });
    expect(model?.selected.grantedCount).toBe(2);
  });

  it("returns nothing without any role", () => {
    expect(
      buildRoleMatrixModel({
        roles: [],
        permissions: PERMISSIONS,
        held: HELD,
        caller: { role: "admin", permissions: [] },
      }),
    ).toBeNull();
  });
});
