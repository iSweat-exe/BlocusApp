import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthReport } from "./collect";
import { HealthView } from "./health-view";

const collectHealth = vi.fn();
const recordReport = vi.fn();
const listHealthSnapshots = vi.fn();

vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({}) }));
vi.mock("./collect", () => ({
  collectHealth: () => collectHealth(),
  recordReport: (...args: unknown[]) => recordReport(...args),
}));
vi.mock("@/lib/data/health", () => ({ listHealthSnapshots: () => listHealthSnapshots() }));

const report: HealthReport = {
  at: "2026-10-09T10:00:00.000Z",
  score: 94,
  status: "ok",
  dbMs: 85,
  authMs: 140,
  stats: { usersTotal: 120, usersActive: 7, dbSizeBytes: 50 * 1024 * 1024 },
  vercel: { kind: "not_configured" },
  cronAgeHours: 12,
  config: [
    { key: "CRON_SECRET", label: "Secret du cron", hint: "x", ok: true, required: true },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Clé service Supabase",
      hint: "Sans elle, pas d'historique.",
      ok: false,
      required: true,
    },
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
      { name: "audit_logs", bytes: 8 * 1024 * 1024 },
      { name: "profiles", bytes: 1024 * 1024 },
    ],
    connections: { open: 12, max: 60 },
  },
};

const snapshot = (id: number, score: number) => ({
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

beforeEach(() => {
  vi.clearAllMocks();
  collectHealth.mockResolvedValue(report);
  recordReport.mockResolvedValue({ ok: true, value: true });
  listHealthSnapshots.mockResolvedValue({ ok: true, value: [] });
});

async function renderView() {
  render(await HealthView());
}

describe("HealthView", () => {
  it("shows the score, the services, the storage and the users", async () => {
    await renderView();
    expect(screen.getByText("94")).toBeInTheDocument();
    expect(screen.getByText("Opérationnel")).toBeInTheDocument();
    expect(screen.getByText("85 ms")).toBeInTheDocument();
    expect(screen.getByText("140 ms")).toBeInTheDocument();
    expect(screen.getByText("50,0 Mo / 500,0 Mo")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows the cron, the connections, the heaviest tables and the 7-day trend", async () => {
    await renderView();
    expect(screen.getByText("À jour")).toBeInTheDocument();
    expect(screen.getByText("12 / 60")).toBeInTheDocument();
    expect(screen.getByText("20 % de la limite du serveur")).toBeInTheDocument();
    expect(screen.getByText("audit_logs")).toBeInTheDocument();
    expect(screen.getByText("8,0 Mo")).toBeInTheDocument();
    expect(screen.getByText("97,5 %")).toBeInTheDocument();
    expect(screen.getByText("120 ms")).toBeInTheDocument();
  });

  it("warns when the daily cron is late or never ran", async () => {
    collectHealth.mockResolvedValue({ ...report, cronAgeHours: 50 });
    await renderView();
    expect(screen.getByText("En retard")).toBeInTheDocument();
    cleanup();

    collectHealth.mockResolvedValue({
      ...report,
      cronAgeHours: null,
      details: { ...report.details, trends: null, tables: null, connections: null },
    });
    await renderView();
    expect(screen.getByText("Jamais exécutée")).toBeInTheDocument();
  });

  it("lists the configuration checks and what is missing", async () => {
    await renderView();
    expect(screen.getByText("Configuré")).toBeInTheDocument();
    expect(screen.getByText("Manquant")).toBeInTheDocument();
    expect(screen.getByText("Sans elle, pas d'historique.")).toBeInTheDocument();
  });

  it("says Vercel is not configured instead of failing", async () => {
    await renderView();
    expect(screen.getByText("Non configuré")).toBeInTheDocument();
  });

  it("flags unreachable services and unreadable counters", async () => {
    collectHealth.mockResolvedValue({
      ...report,
      score: 20,
      status: "down",
      dbMs: null,
      stats: null,
    });
    await renderView();
    expect(screen.getByText("Critique")).toBeInTheDocument();
    expect(screen.getByText("Injoignable")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("stores a snapshot of the page and draws the history once it has two points", async () => {
    await renderView();
    expect(recordReport).toHaveBeenCalledWith(expect.anything(), report, "page");
    expect(screen.getByText(/L'historique se construit/)).toBeInTheDocument();

    listHealthSnapshots.mockResolvedValue({ ok: true, value: [snapshot(1, 90), snapshot(2, 70)] });
    await renderView();
    expect(screen.getByRole("img", { name: /de 90 à 70, minimum 70/ })).toBeInTheDocument();
  });
});
