import { describe, expect, it } from "vitest";
import { adminLinksFor } from "./admin-links";
import {
  AUDIT_ACTIONS,
  describeAuditEntry,
  parseJournalParams,
  type AuditEntryView,
  type AuditNames,
} from "./audit";

const NAMES: AuditNames = {
  users: new Map([
    ["a", "alice"],
    ["b", "bob"],
  ]),
  roles: new Map([
    ["user", "Utilisateur"],
    ["manager", "Gérant"],
  ]),
  permissions: (key) => (key === "user.ban" ? "Bannir un utilisateur" : key),
};

const entry = (over: Partial<AuditEntryView>): AuditEntryView => ({
  id: 1,
  actor_id: "a",
  action: "role.assigned",
  target_id: "b",
  details: {},
  created_at: "2026-10-07T12:00:00Z",
  ...over,
});

describe("parseJournalParams", () => {
  it("keeps a known action and a positive integer cursor", () => {
    expect(parseJournalParams({ action: "user.banned", before: "42" })).toEqual({
      action: "user.banned",
      before: 42,
    });
  });

  it.each([
    [{ action: "drop.table", before: "0" }],
    [{ action: 3, before: "-1" }],
    [{ action: undefined, before: "1; drop" }],
    [{ before: "9".repeat(20) }],
    [{}],
  ])("ignores invalid values (%j)", (raw) => {
    expect(parseJournalParams(raw)).toEqual({ action: null, before: null });
  });
});

describe("describeAuditEntry", () => {
  it("describes role changes with role labels", () => {
    expect(describeAuditEntry(entry({ details: { from: "user", to: "manager" } }), NAMES)).toBe(
      "alice a changé le rôle de bob : Utilisateur → Gérant.",
    );
  });

  it("describes permission changes", () => {
    expect(
      describeAuditEntry(
        entry({
          action: "role_permission.granted",
          target_id: null,
          details: { role: "manager", permission: "user.ban" },
        }),
        NAMES,
      ),
    ).toBe("alice a accordé « Bannir un utilisateur » au rôle Gérant.");
    expect(
      describeAuditEntry(
        entry({ action: "user_permission.denied", details: { permission: "user.ban" } }),
        NAMES,
      ),
    ).toBe("alice a refusé « Bannir un utilisateur » à bob.");
    expect(
      describeAuditEntry(
        entry({ action: "user_permission.cleared", details: { permission: "x.y" } }),
        NAMES,
      ),
    ).toBe("alice a réinitialisé « x.y » pour bob.");
  });

  it("describes permanent and temporary bans, and lifted sanctions", () => {
    const permanent = describeAuditEntry(
      entry({ action: "user.banned", details: { reason: "spam", expires_at: null } }),
      NAMES,
    );
    expect(permanent).toBe("alice a banni bob définitivement — motif : spam.");
    const temporary = describeAuditEntry(
      entry({
        action: "user.banned",
        details: { reason: "spam", expires_at: "2026-12-01T10:00:00Z" },
      }),
      NAMES,
    );
    expect(temporary).toContain("jusqu'au");
    expect(describeAuditEntry(entry({ action: "sanction.revoked" }), NAMES)).toBe(
      "alice a levé une sanction de bob.",
    );
  });

  it("describes finished and reopened events", () => {
    const details = { event_id: "e1", title: "Rassemblement" };
    expect(
      describeAuditEntry(entry({ action: "event.finished", target_id: null, details }), NAMES),
    ).toBe("alice a marqué l'événement « Rassemblement » comme terminé.");
    expect(
      describeAuditEntry(entry({ action: "event.reopened", target_id: null, details }), NAMES),
    ).toBe("alice a rouvert l'événement « Rassemblement ».");
  });

  it("describes a route save with its number of points", () => {
    expect(
      describeAuditEntry(
        entry({ action: "map.route_saved", target_id: null, details: { points: 12 } }),
        NAMES,
      ),
    ).toBe("alice a modifié le tracé de la carte (12 points).");
    expect(AUDIT_ACTIONS["map.route_saved"]).toBeDefined();
  });

  it("describes a declared position, with or without a label", () => {
    expect(
      describeAuditEntry(
        entry({ action: "map.position_declared", target_id: null, details: { label: "Place" } }),
        NAMES,
      ),
    ).toBe("alice a déclaré la position de la manifestation : Place.");
    expect(
      describeAuditEntry(
        entry({ action: "map.position_declared", target_id: null, details: { label: "" } }),
        NAMES,
      ),
    ).toBe("alice a déclaré la position de la manifestation.");
  });

  it("describes a removed position, own or somebody else's", () => {
    expect(
      describeAuditEntry(
        entry({
          action: "map.position_removed",
          target_id: null,
          details: { label: "Place", own: true },
        }),
        NAMES,
      ),
    ).toBe("alice a retiré sa position de la manifestation (Place).");
    expect(
      describeAuditEntry(
        entry({
          action: "map.position_removed",
          target_id: null,
          details: { label: "", own: false },
        }),
        NAMES,
      ),
    ).toBe("alice a retiré une position de la manifestation.");
  });

  it("copes with deleted accounts, missing details and unknown actions", () => {
    expect(describeAuditEntry(entry({ actor_id: "zzzzzzzzzz", details: null }), NAMES)).toContain(
      "compte supprimé (zzzzzzzz)",
    );
    expect(describeAuditEntry(entry({ actor_id: null, action: "future.thing" }), NAMES)).toBe(
      "Système : future.thing (bob).",
    );
  });

  it("lists every action it knows how to describe", () => {
    expect(Object.keys(AUDIT_ACTIONS)).toContain("user.banned");
  });
});

describe("adminLinksFor", () => {
  it("shows the sections the permissions allow", () => {
    expect(adminLinksFor([]).map((link) => link.href)).toEqual(["/admin"]);
    expect(adminLinksFor(["permission.manage", "audit.read"]).map((link) => link.href)).toEqual([
      "/admin",
      "/admin/roles",
      "/admin/journal",
    ]);
  });

  it("adds the health section for monitoring.view", () => {
    expect(adminLinksFor(["monitoring.view"]).map((link) => link.href)).toEqual([
      "/admin",
      "/admin/health",
    ]);
  });
});
