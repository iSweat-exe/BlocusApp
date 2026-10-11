import { describe, expect, it } from "vitest";
import { adminLinksFor } from "./admin-links";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  auditDayKey,
  categoryOfAction,
  describeAuditEntry,
  describeAuditEntryParts,
  formatAuditDay,
  formatAuditTime,
  groupAuditByDay,
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
  it("keeps a known category and a positive integer cursor", () => {
    expect(parseJournalParams({ category: "sanctions", before: "42" })).toEqual({
      category: "sanctions",
      before: 42,
    });
  });

  it("still understands the former single-action parameter, as the family of that action", () => {
    expect(parseJournalParams({ action: "user.banned" })).toEqual({
      category: "sanctions",
      before: null,
    });
    expect(parseJournalParams({ action: "user.banned", category: "map" }).category).toBe("map");
  });

  it.each([
    [{ category: "drop.table", before: "0" }],
    [{ category: 3, action: "drop.table", before: "-1" }],
    [{ category: undefined, before: "1; drop" }],
    [{ before: "9".repeat(20) }],
    [{}],
  ])("ignores invalid values (%j)", (raw) => {
    expect(parseJournalParams(raw)).toEqual({ category: null, before: null });
  });
});

describe("audit categories", () => {
  it("puts every known action in exactly one category", () => {
    for (const action of Object.keys(AUDIT_ACTIONS)) {
      const owners = AUDIT_CATEGORIES.filter((category) =>
        (category.actions as readonly string[]).includes(action),
      );
      expect(owners, action).toHaveLength(1);
    }
    for (const category of AUDIT_CATEGORIES) {
      for (const action of category.actions) expect(AUDIT_ACTIONS[action], action).toBeDefined();
    }
  });

  it("names the family of an action, and `other` for an action it does not know", () => {
    expect(categoryOfAction("role_permission.revoked")).toBe("permissions");
    expect(categoryOfAction("map.route_saved")).toBe("map");
    expect(categoryOfAction("future.thing")).toBe("other");
  });
});

describe("days of the journal", () => {
  // 10 October 2026, 21:30 in Paris (UTC+2).
  const NOW = new Date("2026-10-10T19:30:00Z");

  it("labels today and yesterday, then the weekday and date, with the year only when it differs", () => {
    expect(formatAuditDay("2026-10-10T08:00:00Z", NOW)).toBe("Aujourd'hui");
    expect(formatAuditDay("2026-10-09T08:00:00Z", NOW)).toBe("Hier");
    expect(formatAuditDay("2026-10-03T08:00:00Z", NOW)).toBe("samedi 3 octobre");
    expect(formatAuditDay("2025-12-24T08:00:00Z", NOW)).toBe("mercredi 24 décembre 2025");
  });

  it("counts the day in Paris, not in UTC", () => {
    // 22:30 UTC on the 9th is 00:30 on the 10th in Paris.
    expect(auditDayKey("2026-10-09T22:30:00Z")).toBe("2026-10-10");
    expect(formatAuditDay("2026-10-09T22:30:00Z", NOW)).toBe("Aujourd'hui");
  });

  it("finds yesterday across the change to winter time (a 25-hour day)", () => {
    // Winter time starts on Sunday 25 October 2026 at 03:00 (Paris).
    const monday = new Date("2026-10-26T10:00:00Z");
    expect(formatAuditDay("2026-10-25T10:00:00Z", monday)).toBe("Hier");
    expect(formatAuditDay("2026-10-24T10:00:00Z", monday)).toBe("samedi 24 octobre");
  });

  it("formats the time of day in Paris", () => {
    expect(formatAuditTime("2026-10-10T21:24:00Z")).toBe("23:24");
  });

  it("groups entries by day, keeping their order", () => {
    const days = groupAuditByDay(
      [
        { id: 4, created_at: "2026-10-10T18:00:00Z" },
        { id: 3, created_at: "2026-10-10T08:00:00Z" },
        { id: 2, created_at: "2026-10-09T20:00:00Z" },
        { id: 1, created_at: "2026-10-03T09:00:00Z" },
      ],
      NOW,
    );
    expect(days.map((day) => [day.label, day.entries.map((item) => item.id)])).toEqual([
      ["Aujourd'hui", [4, 3]],
      ["Hier", [2]],
      ["samedi 3 octobre", [1]],
    ]);
    expect(groupAuditByDay([], NOW)).toEqual([]);
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

  it("marks the names as strong, and only them", () => {
    const parts = describeAuditEntryParts(
      entry({ details: { from: "user", to: "manager" } }),
      NAMES,
    );
    expect(parts.filter((part) => part.strong).map((part) => part.text)).toEqual([
      "alice",
      "bob",
      "Utilisateur",
      "Gérant",
    ]);
    expect(parts.map((part) => part.text).join("")).toBe(
      "alice a changé le rôle de bob : Utilisateur → Gérant.",
    );
    expect(parts.find((part) => part.text.includes("a changé"))?.strong).toBeUndefined();
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

  it("adds the statistics section for statistics.view, before the health one", () => {
    expect(adminLinksFor(["statistics.view"]).map((link) => link.href)).toEqual([
      "/admin",
      "/admin/statistics",
    ]);
    expect(adminLinksFor(["monitoring.view", "statistics.view"]).map((link) => link.href)).toEqual([
      "/admin",
      "/admin/statistics",
      "/admin/health",
    ]);
  });

  it("adds the health section for monitoring.view", () => {
    expect(adminLinksFor(["monitoring.view"]).map((link) => link.href)).toEqual([
      "/admin",
      "/admin/health",
    ]);
  });
});
