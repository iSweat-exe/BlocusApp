import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, deleteEvent, setEventFinished, updateEvent } from "./actions";

const requirePermission = vi.fn();
const insert = vi.fn();
const select = vi.fn();
const eqId = vi.fn();
const eqAuthor = vi.fn();
const update = vi.fn();
const deleteFn = vi.fn();
const redirect = vi.fn();
const rpc = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: (...args: unknown[]) => updateTag(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: () => ({ insert, update, delete: deleteFn }), rpc }),
}));

const ID = "00000000-0000-0000-0000-00000000e001";
const IDLE = { status: "idle" } as const;
const form = (values: Record<string, string | undefined>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) data.set(key, value);
  });
  return data;
};
// Far in the future so the "no past start" rule never interferes.
const VALID = {
  title: "Départ",
  description: "Place.",
  location: "Gare",
  date: "2099-05-04",
  time: "10:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
  select.mockResolvedValue({ data: [{ id: ID }], error: null });
  eqId.mockReturnValue({ select });
  update.mockReturnValue({ eq: eqId });
  eqAuthor.mockResolvedValue({ error: null });
  deleteFn.mockReturnValue({
    eq: vi.fn(() => Object.assign(Promise.resolve({ error: null }), { eq: eqAuthor })),
  });
});

describe("createEvent", () => {
  it("checks event.create against the database and refuses Guests / other roles", async () => {
    await createEvent(IDLE, form(VALID));
    expect(requirePermission).toHaveBeenCalledWith("event.create", { fresh: true });

    requirePermission.mockResolvedValue({ ok: false, error: "unauthenticated" });
    expect(await createEvent(IDLE, form(VALID))).toMatchObject({ status: "error" });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await createEvent(IDLE, form(VALID))).toMatchObject({ status: "error" });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("returns field errors without touching the database", async () => {
    const state = await createEvent(IDLE, form({ ...VALID, title: " ", time: "99:99" }));
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { title: expect.any(String), time: expect.any(String) },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts UTC instants with the caller as author, ignoring a client-provided author", async () => {
    const state = await createEvent(IDLE, form({ ...VALID, end_time: "12:00", author_id: "evil" }));
    expect(state.status).toBe("success");
    expect(updateTag).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledWith({
      title: "Départ",
      description: "Place.",
      location: "Gare",
      starts_at: "2099-05-04T08:00:00.000Z", // 10:00 in Paris (summer time)
      ends_at: "2099-05-04T10:00:00.000Z",
      author_id: "u1",
    });
  });

  it("translates the past-start database error, with a generic fallback", async () => {
    insert.mockResolvedValue({ error: { message: "event_in_the_past" } });
    expect(await createEvent(IDLE, form(VALID))).toMatchObject({
      status: "error",
      message: expect.stringContaining("passé"),
    });
    insert.mockResolvedValue({ error: { message: "weird" } });
    expect(await createEvent(IDLE, form(VALID))).toMatchObject({
      message: expect.stringContaining("Réessaie"),
    });
  });
});

describe("updateEvent", () => {
  it("rejects a malformed id and users without permission", async () => {
    expect(await updateEvent(IDLE, form({ ...VALID, id: "nope" }))).toEqual({
      status: "error",
      message: "Demande invalide.",
    });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await updateEvent(IDLE, form({ ...VALID, id: ID }))).toMatchObject({ status: "error" });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates the event, allowing a past start (the text of a started event can be edited)", async () => {
    const state = await updateEvent(IDLE, form({ ...VALID, id: ID, date: "2020-01-01" }));
    expect(state.status).toBe("success");
    expect(updateTag).toHaveBeenCalledWith("events");
    expect(eqId).toHaveBeenCalledWith("id", ID);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ title: "Départ" }));
  });

  it("reports when nothing matched (someone else's event) or the database failed", async () => {
    select.mockResolvedValue({ data: [], error: null });
    expect(await updateEvent(IDLE, form({ ...VALID, id: ID }))).toMatchObject({
      status: "error",
      message: expect.stringContaining("terminé"),
    });
    select.mockResolvedValue({ data: null, error: { message: "event_in_the_past" } });
    expect(await updateEvent(IDLE, form({ ...VALID, id: ID }))).toMatchObject({
      message: expect.stringContaining("passé"),
    });
  });
});

describe("deleteEvent", () => {
  it("ignores malformed ids and users without any permission", async () => {
    await deleteEvent(form({ id: "nope" }));
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    await deleteEvent(form({ id: ID }));
    expect(deleteFn).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("deletes any event with event.delete, then goes back to the calendar", async () => {
    requirePermission.mockResolvedValueOnce({ ok: true, value: { userId: "mod" } });
    await deleteEvent(form({ id: ID }));
    expect(eqAuthor).not.toHaveBeenCalled();
    expect(updateTag).toHaveBeenCalledWith("events");
    expect(redirect).toHaveBeenCalledWith("/calendar");
  });

  it("restricts creators to their own events", async () => {
    requirePermission
      .mockResolvedValueOnce({ ok: false, error: "forbidden" })
      .mockResolvedValueOnce({ ok: true, value: { userId: "u1" } });
    await deleteEvent(form({ id: ID }));
    expect(eqAuthor).toHaveBeenCalledWith("author_id", "u1");
    expect(redirect).toHaveBeenCalledWith("/calendar");
  });
});

describe("setEventFinished", () => {
  it("rejects malformed input before any permission check", async () => {
    for (const values of [
      { id: "nope", finished: "true" },
      { id: ID, finished: "maybe" },
      { finished: "true" },
    ]) {
      expect(await setEventFinished(IDLE, form(values))).toEqual({
        status: "error",
        message: "Demande invalide.",
      });
    }
    expect(requirePermission).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks event.finish against the database and refuses Guests and other roles", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "unauthenticated" });
    expect(await setEventFinished(IDLE, form({ id: ID, finished: "true" }))).toMatchObject({
      status: "error",
    });
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await setEventFinished(IDLE, form({ id: ID, finished: "true" }))).toMatchObject({
      status: "error",
    });
    expect(requirePermission).toHaveBeenCalledWith("event.finish", { fresh: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("finishes or reopens through the RPC", async () => {
    expect(await setEventFinished(IDLE, form({ id: ID, finished: "true" }))).toMatchObject({
      status: "success",
      message: "Événement terminé.",
    });
    expect(rpc).toHaveBeenLastCalledWith("set_event_finished", { p_id: ID, p_finished: true });
    expect(updateTag).toHaveBeenCalledWith("events");
    expect(await setEventFinished(IDLE, form({ id: ID, finished: "false" }))).toMatchObject({
      message: "Événement rouvert.",
    });
    expect(rpc).toHaveBeenLastCalledWith("set_event_finished", { p_id: ID, p_finished: false });
  });

  it("translates database errors, with a generic fallback", async () => {
    rpc.mockResolvedValue({ error: { message: "unknown_event" } });
    expect(await setEventFinished(IDLE, form({ id: ID, finished: "true" }))).toMatchObject({
      status: "error",
      message: expect.stringContaining("n'existe plus"),
    });
    rpc.mockResolvedValue({ error: { message: "weird" } });
    expect(await setEventFinished(IDLE, form({ id: ID, finished: "true" }))).toMatchObject({
      message: expect.stringContaining("Réessaie"),
    });
  });
});
