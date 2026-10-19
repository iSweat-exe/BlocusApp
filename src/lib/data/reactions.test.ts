import { beforeEach, describe, expect, it, vi } from "vitest";
import { listMyReactions, listReactionTotals } from "./reactions";

const from = vi.fn();
const select = vi.fn();
const inFn = vi.fn();
const eq = vi.fn();
const cacheTag = vi.fn();

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: (...args: unknown[]) => cacheTag(...args),
}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from }) }));
vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ in: inFn, eq });
  eq.mockReturnValue({ in: inFn });
});

describe("listReactionTotals", () => {
  it("groups the totals per post and emoji, under the shared 'reactions' tag", async () => {
    inFn.mockResolvedValue({
      data: [
        { announcement_id: "p1", emoji: "👍", total: 3 },
        { announcement_id: "p1", emoji: "🔥", total: 1 },
        { announcement_id: "p2", emoji: "👏", total: 2 },
      ],
      error: null,
    });
    const result = await listReactionTotals(["p1", "p2"]);
    expect(result).toEqual({ ok: true, value: { p1: { "👍": 3, "🔥": 1 }, p2: { "👏": 2 } } });
    expect(from).toHaveBeenCalledWith("announcement_reaction_counts");
    expect(cacheTag).toHaveBeenCalledWith("reactions");
  });

  it("does not query when the page has no post", async () => {
    await expect(listReactionTotals([])).resolves.toEqual({ ok: true, value: {} });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns an error instead of throwing", async () => {
    inFn.mockResolvedValue({ data: null, error: { message: "down" } });
    expect((await listReactionTotals(["p1"])).ok).toBe(false);
  });
});

describe("listMyReactions", () => {
  it("lists the viewer's emojis per post", async () => {
    inFn.mockResolvedValue({
      data: [
        { announcement_id: "p1", emoji: "👍" },
        { announcement_id: "p1", emoji: "🔥" },
      ],
      error: null,
    });
    await expect(listMyReactions("u1", ["p1"])).resolves.toEqual({
      ok: true,
      value: { p1: ["👍", "🔥"] },
    });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("returns an error instead of throwing", async () => {
    inFn.mockResolvedValue({ data: null, error: { message: "down" } });
    expect((await listMyReactions("u1", ["p1"])).ok).toBe(false);
  });
});
