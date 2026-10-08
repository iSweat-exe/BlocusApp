import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITED_MESSAGE } from "@/server/rate-limit";
import { deleteAnnouncement, publishAnnouncement, updateAnnouncement } from "./actions";

const requirePermission = vi.fn();
const updateTag = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const insert = vi.fn();

// A query builder: every method returns the builder, awaiting it gives `result`.
function chain(result: unknown) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["eq", "select", "maybeSingle"]) builder[method] = vi.fn(() => builder);
  return builder;
}
let selectResult: unknown;
let updateResult: unknown;
let deleteResult: unknown;
const selectBuilder = vi.fn();
const updateFn = vi.fn();
const deleteFn = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock("@/server/require-permission", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      insert,
      select: (...args: unknown[]) => {
        selectBuilder(...args);
        return chain(selectResult);
      },
      update: (...args: unknown[]) => {
        updateFn(...args);
        return chain(updateResult);
      },
      delete: () => {
        deleteFn();
        return chain(deleteResult);
      },
    }),
    storage: { from: () => ({ upload, remove }) },
  }),
}));

const ID = "00000000-0000-0000-0000-00000000f001";
const OLD_PATH = "u1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp";
const IDLE = { status: "idle" } as const;

const form = (values: Record<string, string | File>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
const webpBytes = () =>
  new Uint8Array([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP"), 0, 0]);
const webpFile = (size = 12) =>
  new File([new Uint8Array(size).fill(1).map((_, i) => webpBytes()[i] ?? 0)], "x.webp", {
    type: "image/webp",
  });
const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])], "x.png");

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
  insert.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  selectResult = { data: { image_path: OLD_PATH }, error: null };
  updateResult = { data: [{ id: ID }], error: null };
  deleteResult = { error: null };
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
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    const state = await publishAnnouncement(IDLE, form({ title: " ", body: "b" }));
    expect(state).toMatchObject({ status: "error", fieldErrors: { title: expect.any(String) } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts with the caller as author, ignoring any client-provided author", async () => {
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "Départ", body: "14h", author_id: "someone-else" }),
    );
    expect(state).toEqual({ status: "success", message: "Annonce publiée." });
    expect(insert).toHaveBeenCalledWith({
      title: "Départ",
      body: "14h",
      status: "public",
      show_author: false,
      author_id: "u1",
      image_path: null,
      image_width: null,
      image_height: null,
    });
    expect(updateTag).toHaveBeenCalledWith("announcements");
    expect(upload).not.toHaveBeenCalled();
  });

  it("saves a draft or a private post with its own message, and the show-author choice", async () => {
    expect(
      await publishAnnouncement(IDLE, form({ title: "t", body: "b", status: "draft" })),
    ).toMatchObject({ message: "Brouillon enregistré." });
    expect(
      await publishAnnouncement(
        IDLE,
        form({ title: "t", body: "b", status: "private", show_author: "on" }),
      ),
    ).toMatchObject({ message: "Post privé enregistré." });
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "private", show_author: true }),
    );
  });

  it("uploads the image into the caller's folder, then stores its path and size", async () => {
    const state = await publishAnnouncement(
      IDLE,
      form({
        title: "t",
        body: "b",
        image: webpFile(),
        image_width: "800",
        image_height: "600",
      }),
    );
    expect(state.status).toBe("success");

    const [path, , options] = upload.mock.calls[0]!;
    expect(path).toMatch(/^u1\/[0-9a-f-]{36}\.webp$/);
    expect(options).toMatchObject({ contentType: "image/webp", upsert: false });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ image_path: path, image_width: 800, image_height: 600 }),
    );
  });

  it.each([
    ["too heavy", () => webpFile(301 * 1024), "trop lourde"],
    ["not WebP or JPEG", pngFile, "Format"],
  ])("refuses an image that is %s, before uploading anything", async (_name, make, text) => {
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "t", body: "b", image: make(), image_width: "10", image_height: "10" }),
    );
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { image: expect.stringContaining(text) },
    });
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "10"],
    ["10", "99999"],
    ["abc", "10"],
    ["", ""],
  ])("refuses image dimensions %s x %s", async (width, height) => {
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "t", body: "b", image: webpFile(), image_width: width, image_height: height }),
    );
    expect(state).toMatchObject({ status: "error", fieldErrors: { image: expect.any(String) } });
    expect(upload).not.toHaveBeenCalled();
  });

  it("stops when the upload fails, without creating the post", async () => {
    upload.mockResolvedValue({ error: { message: "boom" } });
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "t", body: "b", image: webpFile(), image_width: "10", image_height: "10" }),
    );
    expect(state.status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });

  it("removes the uploaded file when the post cannot be created", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "t", body: "b", image: webpFile(), image_width: "10", image_height: "10" }),
    );
    expect(state.status).toBe("error");
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]]);
  });

  it("reports a database failure", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    expect(await publishAnnouncement(IDLE, form({ title: "t", body: "b" }))).toMatchObject({
      status: "error",
    });
  });

  it("tells the user to slow down when the database rate limit is hit, and removes the file", async () => {
    insert.mockResolvedValue({ error: { message: "rate_limited" } });
    const state = await publishAnnouncement(
      IDLE,
      form({ title: "t", body: "b", image: webpFile(), image_width: "10", image_height: "10" }),
    );
    expect(state).toEqual({ status: "error", message: RATE_LIMITED_MESSAGE });
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]]);
  });
});

describe("updateAnnouncement", () => {
  const edit = (extra: Record<string, string | File> = {}) =>
    form({ id: ID, title: "Nouveau", body: "Texte", ...extra });

  it("refuses without the permission and ignores invalid ids", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    expect((await updateAnnouncement(IDLE, edit())).status).toBe("error");
    requirePermission.mockResolvedValue({ ok: true, value: { userId: "u1" } });
    expect(
      await updateAnnouncement(IDLE, form({ id: "nope", title: "t", body: "b" })),
    ).toMatchObject({
      status: "error",
    });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("updates the text and visibility and leaves the image alone", async () => {
    const state = await updateAnnouncement(IDLE, edit({ status: "private", show_author: "on" }));
    expect(state).toEqual({ status: "success", message: "Post privé mis à jour." });
    expect(updateFn).toHaveBeenCalledWith({
      title: "Nouveau",
      body: "Texte",
      status: "private",
      show_author: true,
    });
    expect(remove).not.toHaveBeenCalled();
    expect(updateTag).toHaveBeenCalledWith("announcements");
  });

  it("replaces the image, then removes the old file", async () => {
    await updateAnnouncement(
      IDLE,
      edit({ image: webpFile(), image_width: "800", image_height: "600" }),
    );
    const newPath = upload.mock.calls[0]![0];
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ image_path: newPath, image_width: 800, image_height: 600 }),
    );
    expect(remove).toHaveBeenCalledWith([OLD_PATH]);
  });

  it("removes the image on request", async () => {
    await updateAnnouncement(IDLE, edit({ remove_image: "1" }));
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ image_path: null, image_width: null, image_height: null }),
    );
    expect(remove).toHaveBeenCalledWith([OLD_PATH]);
  });

  it("answers that the post is gone when it is not the caller's", async () => {
    selectResult = { data: null, error: null };
    expect(await updateAnnouncement(IDLE, edit())).toMatchObject({ status: "error" });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("removes the new file and keeps the old one when the update fails or changes nothing", async () => {
    updateResult = { data: [], error: null };
    const state = await updateAnnouncement(
      IDLE,
      edit({ image: webpFile(), image_width: "10", image_height: "10" }),
    );
    expect(state.status).toBe("error");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]]);
    expect(remove).not.toHaveBeenCalledWith([OLD_PATH]);
  });

  it("tells the user to slow down when the database rate limit is hit", async () => {
    updateResult = { data: null, error: { message: "rate_limited" } };
    expect(await updateAnnouncement(IDLE, edit({}))).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
  });
});

describe("deleteAnnouncement", () => {
  it("ignores invalid ids", async () => {
    await deleteAnnouncement(form({ id: "not-a-uuid" }));
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("deletes any announcement with announcement.delete, and its image", async () => {
    requirePermission.mockResolvedValueOnce({ ok: true, value: { userId: "mod" } });
    await deleteAnnouncement(form({ id: ID }));
    expect(deleteFn).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([OLD_PATH]);
    expect(updateTag).toHaveBeenCalledWith("announcements");
  });

  it("restricts publishers to their own announcements", async () => {
    requirePermission
      .mockResolvedValueOnce({ ok: false, error: "forbidden" })
      .mockResolvedValueOnce({ ok: true, value: { userId: "u1" } });
    await deleteAnnouncement(form({ id: ID }));
    expect(deleteFn).toHaveBeenCalled();
  });

  it("does nothing without any permission", async () => {
    requirePermission.mockResolvedValue({ ok: false, error: "forbidden" });
    await deleteAnnouncement(form({ id: ID }));
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("keeps the image and the cache when the delete fails", async () => {
    requirePermission.mockResolvedValueOnce({ ok: true, value: { userId: "mod" } });
    deleteResult = { error: { code: "XX000", message: "boom" } };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await deleteAnnouncement(form({ id: ID }));
    expect(remove).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("deletes a post without an image", async () => {
    requirePermission.mockResolvedValueOnce({ ok: true, value: { userId: "mod" } });
    selectResult = { data: { image_path: null }, error: null };
    await deleteAnnouncement(form({ id: ID }));
    expect(remove).not.toHaveBeenCalled();
    expect(updateTag).toHaveBeenCalled();
  });
});
