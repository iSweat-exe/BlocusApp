import { DB_QUOTA_BYTES, THRESHOLDS } from "./score";
import type { VercelStatus } from "./vercel";

/** State of one measure, as a color on the page. `neutral` is a measure that does not exist (yet). */
export type Tone = "ok" | "degraded" | "down" | "neutral";

/** What a tone means, read to assistive technologies next to a value (the color alone says nothing). */
export const TONE_WORDS: Record<Tone, string> = {
  ok: "état bon",
  degraded: "à surveiller",
  down: "état critique",
  neutral: "non mesuré",
};

type Range = { readonly good: number; readonly bad: number };

/** A measure where lower is better: fine up to `good`, critical from `bad`, to watch in between. */
export function lowerIsBetter(value: number, { good, bad }: Range): Tone {
  if (value <= good) return "ok";
  return value >= bad ? "down" : "degraded";
}

/** Round trip of a service: one that does not answer is critical. */
export function latencyTone(ms: number | null, range: Range): Tone {
  return ms === null ? "down" : lowerIsBetter(ms, range);
}

/** Size of the database against the free quota. */
export function storageTone(bytes: number | null): Tone {
  return bytes === null ? "neutral" : lowerIsBetter(bytes / DB_QUOTA_BYTES, THRESHOLDS.dbSize);
}

/** Open connections against the server limit. */
export function connectionsTone(connections: { open: number; max: number } | null): Tone {
  if (!connections || connections.max <= 0) return "neutral";
  return lowerIsBetter(connections.open / connections.max, THRESHOLDS.connections);
}

/** Daily cron: a project left without activity is paused by Supabase, so "never ran" is to watch. */
export function cronTone(ageHours: number | null): Tone {
  return ageHours === null ? "degraded" : lowerIsBetter(ageHours, THRESHOLDS.cronHours);
}

/** Latest production deployment. Not configured is not an incident; an unreachable API is to watch. */
export function vercelTone(vercel: VercelStatus): Tone {
  if (vercel.kind === "not_configured") return "neutral";
  if (vercel.kind === "unavailable") return "degraded";
  if (vercel.state === "READY") return "ok";
  return vercel.state === "ERROR" ? "down" : "degraded";
}

/** Share of the measures of the last 7 days where the score was not critical. */
export function availabilityTone(percent: number | null): Tone {
  if (percent === null) return "neutral";
  if (percent >= 99) return "ok";
  return percent >= 95 ? "degraded" : "down";
}

/** A missing required variable is critical; a missing optional one is only to watch. */
export function configTone(check: { ok: boolean; required: boolean }): Tone {
  if (check.ok) return "ok";
  return check.required ? "down" : "degraded";
}
