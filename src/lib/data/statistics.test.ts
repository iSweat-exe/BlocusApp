import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStatsActivity, getStatsBreakdown, getStatsOverview } from "./statistics";

const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStatsOverview", () => {
  it("maps the row of the database function", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          users_total: 120,
          signups_24h: 3,
          signups_7d: 20,
          signups_30d: 80,
          active_24h: 40,
          active_7d: 70,
          active_30d: 100,
          banned_now: 1,
          posts_public: 12,
          events_total: 9,
          events_upcoming: 4,
          positions_active: 6,
          tracking_since: "2026-10-11T10:00:00+00:00",
        },
      ],
      error: null,
    });

    expect(await getStatsOverview()).toEqual({
      ok: true,
      value: {
        usersTotal: 120,
        signups24h: 3,
        signups7d: 20,
        signups30d: 80,
        active24h: 40,
        active7d: 70,
        active30d: 100,
        bannedNow: 1,
        postsPublic: 12,
        eventsTotal: 9,
        eventsUpcoming: 4,
        positionsActive: 6,
        trackingSince: "2026-10-11T10:00:00+00:00",
      },
    });
    expect(rpc).toHaveBeenCalledWith("stats_overview");
  });

  it("fails when the database refuses (no permission) or returns nothing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect(await getStatsOverview()).toMatchObject({ ok: false, error: "load_failed" });
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getStatsOverview()).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("fails when the call throws", async () => {
    rpc.mockRejectedValue(new Error("network"));
    expect(await getStatsOverview()).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("getStatsActivity", () => {
  it("asks for the window and maps each hour", async () => {
    rpc.mockResolvedValue({
      data: [{ hour: "2026-10-11T10:00:00+00:00", active_users: 5, signups: 1, tracked: true }],
      error: null,
    });

    expect(await getStatsActivity(24)).toEqual({
      ok: true,
      value: [{ hour: "2026-10-11T10:00:00+00:00", activeUsers: 5, signups: 1, tracked: true }],
    });
    expect(rpc).toHaveBeenCalledWith("stats_activity", { p_hours: 24 });
  });

  it("asks for 30 days by default", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getStatsActivity();
    expect(rpc).toHaveBeenCalledWith("stats_activity", { p_hours: 720 });
  });

  it("reports a failed read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getStatsActivity()).toMatchObject({ ok: false, error: "load_failed" });
  });
});

describe("getStatsBreakdown", () => {
  it("splits the rows by kind", async () => {
    rpc.mockResolvedValue({
      data: [
        { kind: "role", key: "user", total: 90 },
        { kind: "role", key: "admin", total: 2 },
        { kind: "provider", key: "discord", total: 70 },
        { kind: "country", key: "FR", total: 50 },
        { kind: "country", key: "unknown", total: 40 },
      ],
      error: null,
    });

    expect(await getStatsBreakdown()).toEqual({
      ok: true,
      value: {
        roles: [
          { key: "user", total: 90 },
          { key: "admin", total: 2 },
        ],
        providers: [{ key: "discord", total: 70 }],
        countries: [
          { key: "FR", total: 50 },
          { key: "unknown", total: 40 },
        ],
      },
    });
  });

  it("reports a failed read", async () => {
    rpc.mockRejectedValue(new Error("network"));
    expect(await getStatsBreakdown()).toMatchObject({ ok: false, error: "load_failed" });
  });
});
