import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ActivityHour, StatsBreakdown, StatsOverview } from "@/lib/data/statistics";
import { StatisticsDashboard, type StatisticsData } from "./statistics-dashboard";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} aria-current={rest["aria-current"] as "page" | undefined}>
      {children}
    </a>
  ),
}));

/** The hour in progress: 12:00 UTC on Sunday 11 October 2026 (14 h in Paris). */
const NOW = Date.parse("2026-10-11T12:30:00Z");
const LAST_HOUR = Date.parse("2026-10-11T12:00:00Z");

/** 720 hours ending with the current one. `trackedFrom` is the index of the first measured hour. */
function activity(trackedFrom: number, activeAt: (hour: number) => number): ActivityHour[] {
  return Array.from({ length: 720 }, (_, index) => {
    const date = new Date(LAST_HOUR - (719 - index) * 3_600_000);
    return {
      hour: date.toISOString(),
      activeUsers: index >= trackedFrom ? activeAt(date.getUTCHours()) : 0,
      signups: 0,
      tracked: index >= trackedFrom,
    };
  });
}

const OVERVIEW: StatsOverview = {
  usersTotal: 200,
  signups24h: 3,
  signups7d: 20,
  signups30d: 80,
  active24h: 50,
  active7d: 120,
  active30d: 180,
  bannedNow: 2,
  postsPublic: 12,
  eventsTotal: 9,
  eventsUpcoming: 4,
  positionsActive: 6,
  trackingSince: "2026-09-01T00:00:00Z",
};

const BREAKDOWN: StatsBreakdown = {
  roles: [
    { key: "user", total: 190 },
    { key: "admin", total: 2 },
  ],
  providers: [
    { key: "discord", total: 150 },
    { key: "google", total: 50 },
  ],
  countries: [
    { key: "FR", total: 80 },
    { key: "unknown", total: 120 },
  ],
};

const ROLES = [
  { key: "user", label: "Utilisateur", rank: 10 },
  { key: "admin", label: "Administrateur", rank: 40 },
];

function data(over: Partial<StatisticsData> = {}): StatisticsData {
  return {
    overview: { ok: true, value: OVERVIEW },
    // Busiest at 20:00 UTC (22 h in Paris), measured over the last 10 days.
    activity: {
      ok: true,
      value: activity(480, (hour) => (hour === 20 ? 9 : 2)),
    },
    breakdown: { ok: true, value: BREAKDOWN },
    roles: { ok: true, value: ROLES },
    ...over,
  };
}

const show = (over: Partial<StatisticsData> = {}, period: "24h" | "7d" | "30d" = "7d") =>
  render(<StatisticsDashboard data={data(over)} period={period} now={NOW} />);

describe("StatisticsDashboard: overview", () => {
  it("shows the headline figures with their context", () => {
    show();
    const section = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(section).getByText("Inscrits").nextElementSibling).toHaveTextContent("200");
    expect(within(section).getByText("+20 sur 7 jours")).toBeInTheDocument();
    expect(within(section).getByText("Actifs (24 h)").nextElementSibling).toHaveTextContent("50");
    expect(within(section).getByText("25 % des inscrits")).toBeInTheDocument();
    expect(within(section).getByText("Bannis en cours").nextElementSibling).toHaveTextContent("2");
  });

  it("says the measure is pending, and shows no zero, while no activity was recorded", () => {
    show({
      overview: { ok: true, value: { ...OVERVIEW, trackingSince: null, active24h: 0 } },
      activity: { ok: true, value: activity(720, () => 0) },
    });
    const section = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(section).getByText("Actifs (24 h)").nextElementSibling).toHaveTextContent("—");
    expect(within(section).getAllByText("Mesure en attente")).toHaveLength(3);
  });

  it("flags a window that the tracking does not cover yet", () => {
    show({ overview: { ok: true, value: { ...OVERVIEW, trackingSince: "2026-10-10T00:00:00Z" } } });
    const section = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(section).getAllByText(/Mesuré depuis le 10 oct/).length).toBeGreaterThan(0);
  });
});

describe("StatisticsDashboard: trend", () => {
  it("offers the three windows as links and marks the current one", () => {
    show({}, "24h");
    const nav = screen.getByRole("navigation", { name: "Période" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/statistics?period=24h",
      "/admin/statistics",
      "/admin/statistics?period=30d",
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("24 heures");
  });

  it("describes the activity chart with its peak", () => {
    show();
    const chart = screen.getByRole("img", { name: /Utilisateurs actifs par heure sur 168 heures/ });
    expect(chart.getAttribute("aria-label")).toMatch(/pic de 9/);
    expect(screen.getByText("Moyenne par heure")).toBeInTheDocument();
  });

  it("windows the chart on the selected period", () => {
    show({}, "30d");
    expect(screen.getByRole("img", { name: /sur 720 heures/ })).toBeInTheDocument();
  });

  it("explains that nothing was measured yet instead of drawing a flat line", () => {
    show({ activity: { ok: true, value: activity(720, () => 0) } });
    expect(screen.getByText(/pas encore mesurée/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Utilisateurs actifs/ })).toBeNull();
  });

  it("tells when a window starts before the tracking", () => {
    show({}, "30d");
    expect(screen.getByText(/Mesure active depuis le/)).toBeInTheDocument();
  });

  it("says when nobody signed up in the window, and charts it otherwise", () => {
    show();
    expect(screen.getByText("Aucune inscription sur cette période.")).toBeInTheDocument();

    const rows = activity(0, () => 1);
    rows[rows.length - 1]!.signups = 3;
    show({ activity: { ok: true, value: rows } });
    expect(
      screen.getByRole("img", { name: /Inscriptions par heure sur 168 heures, 3 au total/ }),
    ).toBeInTheDocument();
  });
});

describe("StatisticsDashboard: busiest hours", () => {
  it("names the busiest hour of the day, in Paris time", () => {
    show();
    const section = screen.getByRole("region", { name: "Heures de pointe" });
    expect(
      within(section).getByText("22 h", { selector: "span.font-semibold" }),
    ).toBeInTheDocument();
    expect(within(section).getByText(/en moyenne 9 utilisateurs/)).toBeInTheDocument();
  });

  it("waits for data instead of drawing an empty chart", () => {
    show({ activity: { ok: true, value: activity(720, () => 0) } });
    const section = screen.getByRole("region", { name: "Heures de pointe" });
    expect(within(section).getByText(/Pas encore assez de données/)).toBeInTheDocument();
  });
});

describe("StatisticsDashboard: distributions and content", () => {
  it("labels roles, providers and countries", () => {
    show();
    const section = screen.getByRole("region", { name: "Répartition des comptes" });
    expect(within(section).getByText("Administrateur")).toBeInTheDocument();
    expect(within(section).getByText("Discord")).toBeInTheDocument();
    expect(within(section).getByText(/France/)).toBeInTheDocument();
    expect(within(section).getByText("Inconnu")).toBeInTheDocument();
    expect(within(section).getByText("150 · 75 %")).toBeInTheDocument();
  });

  it("falls back to the role key when the roles could not be read", () => {
    show({ roles: { ok: false, error: "load_failed" } });
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows the content figures", () => {
    show();
    const section = screen.getByRole("region", { name: "Contenu" });
    expect(within(section).getByText("Événements à venir").nextElementSibling).toHaveTextContent(
      "4",
    );
    expect(within(section).getByText("sur 9 au total")).toBeInTheDocument();
  });
});

describe("StatisticsDashboard: failures", () => {
  it("reports each failed part without hiding the others", () => {
    show({
      overview: { ok: false, error: "load_failed" },
      activity: { ok: false, error: "load_failed" },
    });
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Répartition des comptes" })).toHaveTextContent(
      "Discord",
    );
  });

  it("states when the figures were read", () => {
    show();
    expect(screen.getByText(/Chiffres lus le 11\/10.*14:30/)).toBeInTheDocument();
  });
});
