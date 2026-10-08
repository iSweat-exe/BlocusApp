import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppClient,
  listHealthSnapshots,
  pingAuth,
  pingDatabase,
  readHealthDetails,
  readHealthStats,
  recordHealthSnapshot,
} from "./health";

const rpc = vi.fn();
const limit = vi.fn();
const order = vi.fn();
const select = vi.fn();
const from = vi.fn();
const abortSignal = vi.fn();

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: () => ({ select: () => ({ limit: () => ({ abortSignal }) }) }),
  }),
}));

const client = { rpc, from } as unknown as AppClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("pingDatabase", () => {
  it("returns the round trip in ms when the read works", async () => {
    abortSignal.mockResolvedValue({ error: null });
    expect(await pingDatabase()).toEqual(expect.any(Number));
  });

  it("returns null when the read fails or throws", async () => {
    abortSignal.mockResolvedValue({ error: { message: "boom" } });
    expect(await pingDatabase()).toBeNull();
    abortSignal.mockRejectedValue(new Error("timeout"));
    expect(await pingDatabase()).toBeNull();
  });
});

describe("pingAuth", () => {
  it("calls the Auth health endpoint with the public key", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await pingAuth()).toEqual(expect.any(Number));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://x.supabase.co/auth/v1/health");
    expect(init?.headers).toEqual({ apikey: "pub" });
  });

  it("returns null on an HTTP error or a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 503 })),
    );
    expect(await pingAuth()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await pingAuth()).toBeNull();
  });
});

describe("readHealthStats", () => {
  it("maps the counters", async () => {
    rpc.mockResolvedValue({
      data: [{ users_total: 120, users_active: 7, db_size_bytes: 5000 }],
      error: null,
    });
    expect(await readHealthStats(client)).toEqual({
      ok: true,
      value: { usersTotal: 120, usersActive: 7, dbSizeBytes: 5000 },
    });
    expect(rpc).toHaveBeenCalledWith("health_stats");
  });

  it("fails on an error, an empty answer or an exception", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect(await readHealthStats(client)).toEqual({
      ok: false,
      error: "load_failed",
      message: "forbidden",
    });
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await readHealthStats(client)).ok).toBe(false);
    rpc.mockRejectedValue(new Error("network"));
    expect(await readHealthStats(client)).toMatchObject({ ok: false, message: "network" });
  });
});

describe("readHealthDetails", () => {
  const answers: Record<string, unknown> = {
    health_trends: {
      data: [
        {
          snapshots_7d: 40,
          up_7d: 39,
          min_score_7d: 72,
          p95_db_ms_24h: 120,
          p95_db_ms_7d: 300,
          last_cron_at: "2026-10-08T22:00:00.000Z",
        },
      ],
      error: null,
    },
    health_tables: { data: [{ table_name: "audit_logs", size_bytes: 1000 }], error: null },
    health_connections: { data: [{ open_connections: 12, max_connections: 60 }], error: null },
  };

  it("maps the trends, the tables and the connections", async () => {
    rpc.mockImplementation(async (name: string) => answers[name]);
    expect(await readHealthDetails(client)).toEqual({
      trends: {
        snapshots7d: 40,
        up7d: 39,
        minScore7d: 72,
        p95Db24h: 120,
        p95Db7d: 300,
        lastCronAt: "2026-10-08T22:00:00.000Z",
      },
      tables: [{ name: "audit_logs", bytes: 1000 }],
      connections: { open: 12, max: 60 },
    });
  });

  it("gives null for what cannot be read, without failing the others", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "health_trends") return { data: null, error: { message: "boom" } };
      if (name === "health_tables") throw new Error("network");
      return { data: [], error: null };
    });
    expect(await readHealthDetails(client)).toEqual({
      trends: null,
      tables: null,
      connections: null,
    });
  });
});

describe("recordHealthSnapshot", () => {
  const input = {
    score: 92,
    dbMs: 40,
    authMs: null,
    stats: { usersTotal: 4, usersActive: 1, dbSizeBytes: 9000 },
    vercelState: "READY",
    source: "page" as const,
  };

  it("sends the measures, leaving out the ones that are null", async () => {
    rpc.mockResolvedValue({ data: 17, error: null });
    expect(await recordHealthSnapshot(client, input)).toEqual({ ok: true, value: true });
    expect(rpc).toHaveBeenCalledWith("record_health_snapshot", {
      p_score: 92,
      p_db_ms: 40,
      p_auth_ms: undefined,
      p_db_size_bytes: 9000,
      p_users_total: 4,
      p_users_active: 1,
      p_vercel_state: "READY",
      p_source: "page",
    });
  });

  it("reports a skipped (throttled) snapshot as false", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await recordHealthSnapshot(client, input)).toEqual({ ok: true, value: false });
  });

  it("fails on an error or an exception", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect(await recordHealthSnapshot(client, input)).toMatchObject({
      ok: false,
      error: "record_failed",
    });
    rpc.mockRejectedValue(new Error("network"));
    expect(await recordHealthSnapshot(client, input)).toMatchObject({ ok: false });
  });
});

describe("listHealthSnapshots", () => {
  beforeEach(() => {
    from.mockReturnValue({ select });
    select.mockReturnValue({ order });
    order.mockReturnValue({ limit });
  });

  it("returns the newest rows oldest first", async () => {
    limit.mockResolvedValue({ data: [{ id: 3 }, { id: 2 }, { id: 1 }], error: null });
    expect(await listHealthSnapshots(client)).toEqual({
      ok: true,
      value: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("fails on an error or an exception", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listHealthSnapshots(client)).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockRejectedValue(new Error("network"));
    expect(await listHealthSnapshots(client)).toMatchObject({ ok: false });
  });
});
