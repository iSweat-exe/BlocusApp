import { NextResponse } from "next/server";
import { computeHealthScore, type HealthStatus, statusOfScore } from "@/features/health/score";
import { pingAuth, pingDatabase } from "@/lib/data/health";

const NO_STORE = { "Cache-Control": "no-store" };

/** An answer is reused for this long, so that a public URL cannot be used to hammer the database. */
const CACHE_MS = 10_000;
let cached: { at: number; status: HealthStatus } | null = null;

/**
 * Public health check for an uptime monitor (UptimeRobot, Better Stack...): `200` with `{ status: "ok" }`
 * (or `"degraded"`) while the database and Supabase Auth answer, `503` with `{ status: "down" }` otherwise.
 * It returns nothing but the status, never a measure, a count or a configuration detail (those live on
 * `/admin/health`). The answer is cached for 10 seconds per instance.
 */
export async function GET() {
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_MS) {
    const [dbMs, authMs] = await Promise.all([pingDatabase(), pingAuth()]);
    const score = computeHealthScore({ dbMs, authMs, dbSizeBytes: null, vercelState: null });
    cached = { at: now, status: statusOfScore(score) };
  }
  const { status } = cached;
  return NextResponse.json(
    { status },
    { status: status === "down" ? 503 : 200, headers: NO_STORE },
  );
}
