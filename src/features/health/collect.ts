import {
  type AppClient,
  type HealthDetails,
  type HealthStats,
  pingAuth,
  pingDatabase,
  readHealthDetails,
  readHealthStats,
  recordHealthSnapshot,
} from "@/lib/data/health";
import { type ConfigCheck, checkConfiguration, configShare } from "./config";
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
  details: HealthDetails;
  /** Hours since the daily cron last recorded a snapshot, `null` if it never did. */
  cronAgeHours: number | null;
  config: ConfigCheck[];
};

/** Measures the database, Auth and Vercel at the same time and computes the global score. */
export async function collectHealth(client: AppClient): Promise<HealthReport> {
  const [dbMs, authMs, stats, vercel, details] = await Promise.all([
    pingDatabase(),
    pingAuth(),
    readHealthStats(client),
    fetchVercelStatus(),
    readHealthDetails(client),
  ]);

  const now = Date.now();
  const statsValue = stats.ok ? stats.value : null;
  const lastCron = details.trends?.lastCronAt ?? null;
  const cronAgeHours = lastCron ? Math.max(0, (now - Date.parse(lastCron)) / 3_600_000) : null;
  const config = checkConfiguration();
  const connections = details.connections;

  const score = computeHealthScore({
    dbMs,
    authMs,
    dbSizeBytes: statsValue?.dbSizeBytes ?? null,
    vercelState: vercel.kind === "ok" ? vercel.state : null,
    cronAgeHours,
    connectionsRatio:
      connections && connections.max > 0 ? connections.open / connections.max : null,
    configShare: configShare(config),
  });
  return {
    at: new Date(now).toISOString(),
    score,
    status: statusOfScore(score),
    dbMs,
    authMs,
    stats: statsValue,
    vercel,
    details,
    cronAgeHours,
    config,
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
