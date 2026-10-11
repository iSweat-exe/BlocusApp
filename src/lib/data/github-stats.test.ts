import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getContributorStats, parseContributorStats } from "./github-stats";

// The cache directive and profile are Next.js build features: not under test here.
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const week = (a: number, d: number) => ({ w: 1, a, d, c: 1 });
const contributor = (login: string | null, total: number, weeks: unknown[]) => ({
  total,
  weeks,
  author: login === null ? null : { login },
});

describe("parseContributorStats", () => {
  it("sums the weeks, like the Contributors tab of GitHub", () => {
    const stats = parseContributorStats([
      contributor("iSweat-exe", 91, [week(40000, 2000), week(9776, 1007)]),
      contributor("Ibotweat", 2, [week(269, 80)]),
    ]);
    expect(stats["isweat-exe"]).toEqual({ commits: 91, additions: 49776, deletions: 3007 });
    expect(stats["ibotweat"]).toEqual({ commits: 2, additions: 269, deletions: 80 });
  });

  it("is keyed by lower-case login, so the case of the login written in the code does not matter", () => {
    expect(Object.keys(parseContributorStats([contributor("iSweat-exe", 1, [])]))).toEqual([
      "isweat-exe",
    ]);
  });

  it("skips what does not look like a contributor: no account, no login, no weeks", () => {
    const stats = parseContributorStats([
      contributor(null, 5, [week(1, 1)]),
      contributor("", 5, [week(1, 1)]),
      { total: 3, author: { login: "no-weeks" } },
      "nonsense",
      null,
      contributor("ok", 1, [week(2, 3)]),
    ]);
    expect(Object.keys(stats)).toEqual(["ok"]);
  });

  it("ignores weeks and counts that are not numbers instead of producing NaN", () => {
    const stats = parseContributorStats([
      contributor("x", Number.NaN, [week(5, 1), { a: "9", d: null }, "nope"]),
    ]);
    expect(stats["x"]).toEqual({ commits: 0, additions: 5, deletions: 1 });
  });

  it("returns nothing for an answer that is not a list", () => {
    expect(parseContributorStats({ message: "Not Found" })).toEqual({});
    expect(parseContributorStats(null)).toEqual({});
  });
});

describe("getContributorStats", () => {
  const fetchMock = vi.fn();
  const answer = (status: number, body: unknown = []) =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads the statistics of the repository from the public API", async () => {
    fetchMock.mockResolvedValue(answer(200, [contributor("a", 4, [week(10, 2)])]));

    const result = await getContributorStats("iSweat-exe/BlocusApp");

    expect(result).toEqual({ ok: true, value: { a: { commits: 4, additions: 10, deletions: 2 } } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/repos/iSweat-exe/BlocusApp/stats/contributors");
    expect(init.headers.Accept).toBe("application/vnd.github+json");
    expect(init.headers["User-Agent"]).toBeTruthy();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("waits and asks again while GitHub is still computing the figures (202)", async () => {
    fetchMock
      .mockResolvedValueOnce(answer(202, {}))
      .mockResolvedValueOnce(answer(200, [contributor("a", 1, [week(1, 0)])]));

    const pending = getContributorStats("o/r");
    await vi.advanceTimersByTimeAsync(2000);

    expect(await pending).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a few attempts without throwing", async () => {
    fetchMock.mockResolvedValue(answer(202, {}));

    const pending = getContributorStats("o/r");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toMatchObject({ ok: false, error: "load_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a refusal (rate limit, not found) without throwing, and logs only the status", async () => {
    fetchMock.mockResolvedValue(answer(403));
    expect(await getContributorStats("o/r")).toMatchObject({ ok: false, error: "load_failed" });
    expect(console.warn).toHaveBeenCalledWith("GitHub statistics unavailable:", 403);
  });

  it("reports a network failure without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await getContributorStats("o/r")).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("refuses a repository name that is not owner/name, before any request", async () => {
    for (const bad of ["", "owner", "a/b/c", "a/b?x=1", "../etc/passwd", "a b/c"]) {
      expect(await getContributorStats(bad)).toMatchObject({ ok: false });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
