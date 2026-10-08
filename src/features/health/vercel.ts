/** What is known about the latest production deployment on Vercel. */
export type VercelStatus =
  | { kind: "not_configured" }
  | { kind: "unavailable" }
  | { kind: "ok"; state: string; createdAt: number | null };

type VercelEnv = Readonly<Record<string, string | undefined>>;

/**
 * State of the latest production deployment, from the Vercel REST API (`GET /v6/deployments`).
 * Needs `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID` (`VERCEL_TEAM_ID` when the project belongs to a team), see
 * `docs/runbook.md`. Never throws: a missing configuration or any failure becomes a status.
 */
export async function fetchVercelStatus(
  env: VercelEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<VercelStatus> {
  const token = env.VERCEL_API_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return { kind: "not_configured" };

  const params = new URLSearchParams({ projectId, target: "production", limit: "1" });
  if (env.VERCEL_TEAM_ID) params.set("teamId", env.VERCEL_TEAM_ID);

  try {
    const response = await fetchImpl(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return { kind: "unavailable" };

    const body: unknown = await response.json();
    const first = (body as { deployments?: unknown[] } | null)?.deployments?.[0] as
      { state?: unknown; readyState?: unknown; created?: unknown } | undefined;
    const state = first?.state ?? first?.readyState;
    if (typeof state !== "string") return { kind: "unavailable" };
    return {
      kind: "ok",
      state: state.toUpperCase(),
      createdAt: typeof first?.created === "number" ? first.created : null,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
