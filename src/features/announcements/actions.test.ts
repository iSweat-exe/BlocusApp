import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAnnouncement, publishAnnouncement } from "./actions";

const requirePermission = vi.fn();
const insert = vi.fn();
const eqAuthor = vi.fn();
const eqId = vi.fn();
const deleteFn = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: (...args: unknown[]) => updateTag(...args),
}));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: () => ({ insert, delete: deleteFn }) }),
}));

const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
const IDLE = { status: "idle" } as const;
const ID = "00000000-0000-0000-0000-00000000f001";

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  eqAuthor.mockResolvedValue({ error: null });
  eqId.mockImplementation(() => Object.assign(Promise.resolve({ error: null }), { eq: eqAuthor }));
  deleteFn.mockReturnValue({ eq: eqId });
});

describe("publishAnnouncement", () => {
  it("refuses Guests and users without the permission, without touching the database", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "unauthenticated" });
    expect(await publishAnnouncement(IDLE, form({ title: "t", body: "b" }))).toMatchObject({
      status: "error",
    });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await publishAnnouncement(IDLE, form({ title: "t", body: "b" }))).toMatchObject({
      status: "error",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
    const state = await publishAnnouncement(IDLE, form({ title: " ", body: "b" }));
    expect(state).toMatchObject({ status: "error", fieldErrors: { title: expect.any(String) } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts with the caller as author, ignoring any client-provided author", async () => {
    requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "Départ", body: "14h", author_id: "someone-else" }),
    );
    expect(state.status).toBe("success");
    expect(insert).toHaveBeenCalledWith({ title: "Départ", body: "14h", author_id: "u1" });
    expect(updateTag).toHaveBeenCalledWith("announcements");
  });

  it("reports a database failure", async () => {
    requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
    insert.mockResolvedValue({ error: { message: "boom" } });
    expect(await publishAnnouncement(IDLE, form({ title: "t", body: "b" }))).toMatchObject({
      status: "error",
    });
  });
});

describe("deleteAnnouncement", () => {
  it("ignores invalid ids", async () => {
    await deleteAnnouncement(form({ id: "not-a-uuid" }));
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("deletes any announcement with announcement.delete", async () => {
    requirePermission.mockResolvedValueOnce({ ok: true, value: { userId: "mod" } });
    await deleteAnnouncement(form({ id: ID }));
    expect(updateTag).toHaveBeenCalledWith("announcements");
    expect(eqId).toHaveBeenCalledWith("id", ID);
    expect(eqAuthor).not.toHaveBeenCalled();
  });

  it("restricts publishers to their own announcements", async () => {
    requirePermission
      .mockResolvedValueOnce({ ok: false, error: "forbidden" })
      .mockResolvedValueOnce({ ok: true, value: { userId: "u1" } });
    await deleteAnnouncement(form({ id: ID }));
    expect(eqAuthor).toHaveBeenCalledWith("author_id", "u1");
  });

  it("does nothing without any permission", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    await deleteAnnouncement(form({ id: ID }));
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
