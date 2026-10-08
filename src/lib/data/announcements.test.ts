import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAnnouncements, listMyAnnouncements } from "./announcements";

const limit = vi.fn();
const order = vi.fn();
const select = vi.fn();
const from = vi.fn();
const eq = vi.fn();

const cacheLife = vi.fn();
const cacheTag = vi.fn();

vi.mock("next/cache", () => ({
  cacheLife: (...args: unknown[]) => cacheLife(...args),
  cacheTag: (...args: unknown[]) => cacheTag(...args),
}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from }) }));
vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ order, eq });
  order.mockReturnValue({ order, limit });
  eq.mockReturnValue({ order });
});

const feedRow = {
  id: "1",
  title: "t",
  body: "b",
  published_at: "2026-10-07T10:00:00Z",
  edited_at: null,
  image_path: null,
  image_width: null,
  image_height: null,
  author_id: null,
  author_pseudo: null,
  author_avatar_url: null,
};

describe("listAnnouncements", () => {
  it("is shared by every visitor: public client, 'feed' cache profile, 'announcements' tag", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    await listAnnouncements();
    expect(cacheLife).toHaveBeenCalledWith("feed");
    expect(cacheTag).toHaveBeenCalledWith("announcements");
  });

  it("reads the public feed view, newest published first, with the requested limit", async () => {
    limit.mockResolvedValue({ data: [feedRow], error: null });

    expect(await listAnnouncements(5)).toEqual({ ok: true, value: [feedRow] });
    expect(from).toHaveBeenCalledWith("announcement_feed");
    expect(order).toHaveBeenCalledWith("published_at", { ascending: false });
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

describe("listMyAnnouncements", () => {
  it("reads only the caller's posts, most recently changed first, from the table", async () => {
    limit.mockResolvedValue({ data: [{ id: "1", status: "draft" }], error: null });

    expect(await listMyAnnouncements("u1")).toEqual({
      ok: true,
      value: [{ id: "1", status: "draft" }],
    });
    expect(from).toHaveBeenCalledWith("announcements");
    expect(eq).toHaveBeenCalledWith("author_id", "u1");
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("returns load_failed on an error or an exception", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await listMyAnnouncements("u1")).toMatchObject({ ok: false, error: "load_failed" });
    limit.mockRejectedValue(new Error("network"));
    expect(await listMyAnnouncements("u1")).toMatchObject({ ok: false, error: "load_failed" });
  });
});
