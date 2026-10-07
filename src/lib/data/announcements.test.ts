import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAnnouncements } from "./announcements";

const limit = vi.fn();
const order = vi.fn();
const select = vi.fn();
const from = vi.fn();

const cacheLife = vi.fn();
const cacheTag = vi.fn();

vi.mock("next/cache", () => ({
  cacheLife: (...args: unknown[]) => cacheLife(...args),
  cacheTag: (...args: unknown[]) => cacheTag(...args),
}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ order });
  order.mockReturnValue({ order, limit });
});

describe("listAnnouncements", () => {
  it("is shared by every visitor: public client, 'feed' cache profile, 'announcements' tag", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    await listAnnouncements();
    expect(cacheLife).toHaveBeenCalledWith("feed");
    expect(cacheTag).toHaveBeenCalledWith("announcements");
  });

  it("returns the rows, newest first, with the requested limit", async () => {
    const rows = [{ id: "1", author_id: null, title: "t", body: "b", created_at: "2026-10-07" }];
    limit.mockResolvedValue({ data: rows, error: null });

    expect(await listAnnouncements(5)).toEqual({ ok: true, value: rows });
    expect(from).toHaveBeenCalledWith("announcements");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
  });

  it("returns load_failed on a database error", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listAnnouncements()).toMatchObject({ ok: false, error: "load_failed" });
  });

  it("returns load_failed when the request throws (e.g. network down)", async () => {
    limit.mockRejectedValue(new Error("fetch failed"));
    expect(await listAnnouncements()).toMatchObject({ ok: false, error: "load_failed" });
  });
});
