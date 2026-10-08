/** Size limit of the free Supabase database (see `.dev/constraints.md`). */
export const DB_QUOTA_BYTES = 500 * 1024 * 1024;

/** Measures the global score is computed from. `null` = the measure could not be taken. */
export type ScoreInput = {
  /** Round trip of a tiny read through PostgREST, in ms (`null` = the database does not answer). */
  dbMs: number | null;
  /** Round trip of the Auth health endpoint, in ms (`null` = it does not answer). */
  authMs: number | null;
  /** Size of the database in bytes (`null` = unknown, left out of the score). */
  dbSizeBytes: number | null;
  /** State of the latest production deployment (`null` = not configured or unreachable, left out). */
  vercelState: string | null;
};

export type HealthStatus = "ok" | "degraded" | "down";

/** Share of the weight kept for each Vercel deployment state (unknown states count as degraded). */
const VERCEL_SHARE: Record<string, number> = {
  READY: 1,
  BUILDING: 0.7,
  QUEUED: 0.7,
  INITIALIZING: 0.7,
  CANCELED: 0.5,
  ERROR: 0,
};

/** 1 at or below `good`, 0 at or above `bad`, linear in between. */
function ramp(value: number, good: number, bad: number): number {
  return Math.min(1, Math.max(0, (bad - value) / (bad - good)));
}

/**
 * Global health score from 0 to 100: a weighted average of the measures that exist.
 * - database latency (40): full marks up to 200 ms, none from 1.5 s, or the database does not answer;
 * - Auth latency (25): full marks up to 300 ms, none from 2 s, or Auth does not answer;
 * - database size (20): full marks up to 70 % of the 500 MB quota, none at 100 %;
 * - Vercel deployment (15): `READY` full marks, `ERROR` none.
 * A measure that is unknown (not configured, or the stats could not be read) is left out, not counted as 0.
 */
export function computeHealthScore(input: ScoreInput): number {
  const parts: { weight: number; share: number }[] = [
    { weight: 40, share: input.dbMs === null ? 0 : ramp(input.dbMs, 200, 1500) },
    { weight: 25, share: input.authMs === null ? 0 : ramp(input.authMs, 300, 2000) },
  ];
  if (input.dbSizeBytes !== null) {
    parts.push({ weight: 20, share: ramp(input.dbSizeBytes / DB_QUOTA_BYTES, 0.7, 1) });
  }
  if (input.vercelState !== null) {
    parts.push({ weight: 15, share: VERCEL_SHARE[input.vercelState] ?? 0.5 });
  }
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  const earned = parts.reduce((sum, part) => sum + part.weight * part.share, 0);
  return Math.round((earned / total) * 100);
}

/** Label of a score: 90 and above is healthy, 60 and above degraded, below that down. */
export function statusOfScore(score: number): HealthStatus {
  if (score >= 90) return "ok";
  return score >= 60 ? "degraded" : "down";
}
