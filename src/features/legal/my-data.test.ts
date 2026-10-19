import { describe, expect, it, vi } from "vitest";
import { exportFileName, isDeleteConfirmed, removeUserImages, type ImageStorage } from "./my-data";

describe("isDeleteConfirmed", () => {
  it.each(["SUPPRIMER", "supprimer", "  Supprimer  "])("accepts %j", (typed) => {
    expect(isDeleteConfirmed(typed)).toBe(true);
  });

  it.each(["", "supprime", "SUPPRIMER MON COMPTE", null, undefined, 42])("refuses %j", (typed) => {
    expect(isDeleteConfirmed(typed)).toBe(false);
  });
});

describe("exportFileName", () => {
  it("carries the day of the export", () => {
    expect(exportFileName(new Date("2026-10-19T13:00:00Z"))).toBe(
      "blocus-mes-donnees-2026-10-19.json",
    );
  });
});

describe("removeUserImages", () => {
  const folder = (names: string[][]) => {
    const rounds = [...names];
    return {
      list: vi.fn(async () => ({
        data: (rounds.shift() ?? []).map((name) => ({ name })),
        error: null,
      })),
      remove: vi.fn(async () => ({ error: null })),
    } satisfies ImageStorage;
  };

  it("removes the files of the user's folder until it is empty", async () => {
    const storage = folder([["a.webp", "b.jpg"], ["c.webp"], []]);
    await removeUserImages(storage, "user-1");
    expect(storage.remove).toHaveBeenNthCalledWith(1, ["user-1/a.webp", "user-1/b.jpg"]);
    expect(storage.remove).toHaveBeenNthCalledWith(2, ["user-1/c.webp"]);
    expect(storage.list).toHaveBeenCalledWith("user-1", { limit: 100 });
  });

  it("does nothing for a user without photos", async () => {
    const storage = folder([[]]);
    await removeUserImages(storage, "user-1");
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("fails when Storage does, so the account is not deleted with photos left behind", async () => {
    const storage: ImageStorage = {
      list: async () => ({ data: null, error: { message: "boom" } }),
      remove: vi.fn(),
    };
    await expect(removeUserImages(storage, "user-1")).rejects.toThrow("list failed");
    const failing: ImageStorage = {
      list: async () => ({ data: [{ name: "a.webp" }], error: null }),
      remove: async () => ({ error: { message: "denied" } }),
    };
    await expect(removeUserImages(failing, "user-1")).rejects.toThrow("remove failed");
  });

  it("stops after a bounded number of rounds instead of looping forever", async () => {
    const storage: ImageStorage = {
      list: vi.fn(async () => ({ data: [{ name: "x.webp" }], error: null })),
      remove: vi.fn(async () => ({ error: null })),
    };
    await removeUserImages(storage, "user-1");
    expect(storage.list).toHaveBeenCalledTimes(20);
  });
});
