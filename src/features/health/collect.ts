import {
  type AppClient,
  type HealthStats,
  pingAuth,
  pingDatabase,
  readHealthStats,
  recordHealthSnapshot,
} from "@/lib/data/health";
import { computeHealthScore, type HealthStatus, statusOfScore } from "./score";
import { fetchVercelStatus, type VercelStatus } from "./vercel";

/** One measurement of the whole back end. */
export type HealthReport = {
  /** ISO date of the measurement. */
  at: string;
  score: number;
  status: HealthStatus;
  dbMs: number | null;
  authMs: number | null;
  /** `null` when the counters could not be read. */
  stats: HealthStats | null;
  vercel: VercelStatus;
};

/** Measures the database, Auth and Vercel at the same time and computes the global score. */
export async function collectHealth(client: AppClient): Promise<HealthReport> {
  const [dbMs, authMs, stats, vercel] = await Promise.all([
    pingDatabase(),
    pingAuth(),
    readHealthStats(client),
    fetchVercelStatus(),
  ]);

  const statsValue = stats.ok ? stats.value : null;
  const score = computeHealthScore({
    dbMs,
    authMs,
    dbSizeBytes: statsValue?.dbSizeBytes ?? null,
    vercelState: vercel.kind === "ok" ? vercel.state : null,
  });
  return {
    at: new Date().toISOString(),
    score,
    status: statusOfScore(score),
    dbMs,
    authMs,
    stats: statsValue,
    vercel,
  };
}

/** Stores a report in the history (skipped by the database when one was stored in the last 10 minutes). */
export function recordReport(client: AppClient, report: HealthReport, source: "page" | "cron") {
  return recordHealthSnapshot(client, {
    score: report.score,
    dbMs: report.dbMs,
    authMs: report.authMs,
    stats: report.stats,
    vercelState: report.vercel.kind === "ok" ? report.vercel.state : null,
    source,
  });
}
