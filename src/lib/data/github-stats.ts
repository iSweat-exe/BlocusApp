import { cacheLife } from "next/cache";
import { err, ok, type Result } from "@/lib/result";

/** What GitHub counts for one contributor of the default branch (the figures of its « Contributors » tab). */
export type ContributorStats = { commits: number; additions: number; deletions: number };

/** Statistics by lower-case GitHub login. */
export type ContributorStatsByLogin = Readonly<Record<string, ContributorStats>>;

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** GitHub computes these statistics on demand: the first request answers 202 and the figures come a moment later. */
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 8000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sumWeeks(weeks: unknown[], key: "a" | "d"): number {
  return weeks.reduce<number>((sum, week) => {
    const value = isRecord(week) ? week[key] : undefined;
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

/**
 * Reads the answer of `GET /repos/{owner}/{repo}/stats/contributors`: one entry per contributor with a weekly
 * breakdown of added (`a`) and deleted (`d`) lines. Defensive on purpose, it is data from another site: an entry
 * that does not look like a contributor (no login, e.g. a deleted account) is skipped, never trusted.
 */
export function parseContributorStats(json: unknown): ContributorStatsByLogin {
  const stats: Record<string, ContributorStats> = {};
  if (!Array.isArray(json)) return stats;

  for (const entry of json) {
    if (!isRecord(entry) || !isRecord(entry.author)) continue;
    const login = entry.author.login;
    if (typeof login !== "string" || login === "" || !Array.isArray(entry.weeks)) continue;
    const commits = entry.total;
    stats[login.toLowerCase()] = {
      commits: typeof commits === "number" && Number.isFinite(commits) ? commits : 0,
      additions: sumWeeks(entry.weeks, "a"),
      deletions: sumWeeks(entry.weeks, "d"),
    };
  }
  return stats;
}

/**
 * Reads the contributor statistics of a public repository once for everybody (the same for every visitor): shared
 * through the data cache and refreshed in the background every 15 minutes, which keeps this far below GitHub's
 * 60 requests per hour for requests without a token. Returns `null` on any failure instead of throwing: the page
 * is prerendered at build time, and an error thrown out of a cached function would fail the build.
 */
async function fetchContributorStats(repo: string): Promise<ContributorStatsByLogin | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });

  try {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const response = await fetch(`https://api.github.com/repos/${repo}/stats/contributors`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "blocusapp",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 202) {
        if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      if (!response.ok) {
        console.warn("GitHub statistics unavailable:", response.status);
        return null;
      }
      return parseContributorStats(await response.json());
    }
    console.warn("GitHub statistics unavailable: still computing");
    return null;
  } catch (cause) {
    console.warn(
      "GitHub statistics unavailable:",
      cause instanceof Error ? cause.message : "unknown",
    );
    return null;
  }
}

/**
 * Commits and added / deleted lines of each contributor of a public GitHub repository, as its « Contributors » tab
 * shows them (default branch, merge commits left out). No account or token needed.
 * @param repo - `owner/name`.
 */
export async function getContributorStats(
  repo: string,
): Promise<Result<ContributorStatsByLogin, "load_failed">> {
  if (!REPOSITORY.test(repo)) return err("load_failed", "invalid repository");
  const stats = await fetchContributorStats(repo);
  return stats === null ? err("load_failed") : ok(stats);
}
