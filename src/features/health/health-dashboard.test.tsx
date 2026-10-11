import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HealthSnapshot } from "@/lib/data/health";
import type { HealthReport } from "./collect";
import { HealthDashboard } from "./health-view";

const MB = 1024 * 1024;

const report: HealthReport = {
  at: "2026-10-09T10:00:00.000Z",
  score: 94,
  status: "ok",
  dbMs: 85,
  authMs: 140,
  stats: { usersTotal: 120, usersActive: 7, dbSizeBytes: 50 * MB },
  vercel: { kind: "not_configured" },
  cronAgeHours: 12,
  config: [
    { key: "A", label: "Secret du cron", hint: "x", ok: true, required: true },
    { key: "B", label: "Clé service Supabase", hint: "Sans elle…", ok: false, required: true },
    { key: "C", label: "Jeton Vercel", hint: "Sans lui…", ok: false, required: false },
  ],
  details: {
    trends: {
      snapshots7d: 40,
      up7d: 39,
      minScore7d: 72,
      p95Db24h: 120,
      p95Db7d: 300,
      lastCronAt: "2026-10-08T22:00:00.000Z",
    },
    tables: [
      { name: "audit_logs", bytes: 8 * MB },
      { name: "profiles", bytes: 2 * MB },
    ],
    connections: { open: 12, max: 60 },
  },
};

const snapshot = (id: number, score: number): HealthSnapshot => ({
  id,
  created_at: `2026-10-09T0${id}:00:00.000Z`,
  score,
  db_ms: 80,
  auth_ms: 100,
  db_size_bytes: 1,
  users_total: 1,
  users_active: 1,
  vercel_state: null,
  source: "page",
});

const history = [snapshot(1, 90), snapshot(2, 70)];

/** The row of a service, found by its label. */
function row(label: string): HTMLElement {
  const item = screen.getByText(label).closest("li");
  if (!item) throw new Error(`no row for ${label}`);
  return item;
}

describe("HealthDashboard", () => {
  it("says the state of each service in words too, since a color alone says nothing", () => {
    render(<HealthDashboard report={report} snapshots={[]} />);
    expect(row("Base de données")).toHaveTextContent("85 ms (état bon)");
    expect(row("Vercel")).toHaveTextContent("Non configuré (non mesuré)");
    expect(row("Tâche quotidienne")).toHaveTextContent("À jour (état bon)");
  });

  it("flags a service that is slow, silent, or too full", () => {
    render(
      <HealthDashboard
        report={{
          ...report,
          dbMs: null,
          authMs: 900,
          cronAgeHours: 80,
          stats: { usersTotal: 1, usersActive: 1, dbSizeBytes: 500 * MB },
          details: { ...report.details, connections: { open: 56, max: 60 } },
        }}
        snapshots={[]}
      />,
    );
    expect(row("Base de données")).toHaveTextContent("(état critique)");
    expect(row("Authentification")).toHaveTextContent("(à surveiller)");
    expect(row("Tâche quotidienne")).toHaveTextContent("(état critique)");
    expect(row("Stockage")).toHaveTextContent("(état critique)");
    expect(row("Connexions à la base")).toHaveTextContent("(état critique)");
  });

  it("draws how much of the storage and the connections is used, as a bar", () => {
    render(<HealthDashboard report={report} snapshots={[]} />);
    expect(row("Stockage").querySelector("[style]")).toHaveStyle({ width: "10%" });
    expect(row("Connexions à la base").querySelector("[style]")).toHaveStyle({ width: "20%" });
  });

  it("draws the tables against the heaviest one", () => {
    render(<HealthDashboard report={report} snapshots={[]} />);
    expect(row("audit_logs").querySelector("[style]")).toHaveStyle({ width: "100%" });
    expect(row("profiles").querySelector("[style]")).toHaveStyle({ width: "25%" });
  });

  it("colors the score and its history by the state, not by the brand color", () => {
    const { rerender } = render(<HealthDashboard report={report} snapshots={history} />);
    expect(screen.getByText("Opérationnel").className).toContain("text-success");
    expect(document.querySelector("polyline")?.getAttribute("class")).toContain("stroke-success");

    rerender(
      <HealthDashboard report={{ ...report, score: 20, status: "down" }} snapshots={history} />,
    );
    expect(screen.getByText("Critique").className).toContain("text-danger");
    expect(document.querySelector("polyline")?.getAttribute("class")).toContain("stroke-danger");
  });

  it("counts the configuration that is in place, and colors what is missing by how much it matters", () => {
    render(<HealthDashboard report={report} snapshots={[]} />);
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(within(row("Clé service Supabase")).getByText("Manquant").className).toContain(
      "text-danger",
    );
    expect(within(row("Jeton Vercel")).getByText("Non configuré").className).toContain(
      "text-warning",
    );
  });

  it("keeps the score readable as a figure next to its ring", () => {
    render(<HealthDashboard report={report} snapshots={[]} />);
    const section = screen.getByRole("region", { name: "Score global" });
    expect(within(section).getByText("94")).toBeInTheDocument();
    expect(within(section).getByText("sur 100")).toBeInTheDocument();
  });
});
