import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMyAccount } from "./actions";

const getSessionPermissions = vi.fn();
const deleteUser = vi.fn();
const list = vi.fn();
const remove = vi.fn();
const signOut = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/server/session", () => ({ getSessionPermissions: () => getSessionPermissions() }));
vi.mock("@/lib/supabase/request-cookies", () => ({ requestCookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { signOut } }) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: { admin: { deleteUser } },
    storage: { from: () => ({ list, remove }) },
  }),
}));

const form = (confirmation: string) => {
  const data = new FormData();
  data.set("confirmation", confirmation);
  return data;
};
const IDLE = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getSessionPermissions.mockResolvedValue({ userId: "user-1", role: "user" });
  list.mockResolvedValue({ data: [], error: null });
  remove.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

describe("deleteMyAccount", () => {
  it("needs the confirmation word, and touches nothing without it", async () => {
    const result = await deleteMyAccount(IDLE, form("peut-être"));
    expect(result).toMatchObject({
      status: "error",
      message: expect.stringContaining("SUPPRIMER"),
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a Guest", async () => {
    getSessionPermissions.mockResolvedValue(null);
    const result = await deleteMyAccount(IDLE, form("SUPPRIMER"));
    expect(result.status).toBe("error");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a super administrator, who must hand the role over first", async () => {
    getSessionPermissions.mockResolvedValue({ userId: "user-1", role: "super_admin" });
    const result = await deleteMyAccount(IDLE, form("SUPPRIMER"));
    expect(result).toMatchObject({
      status: "error",
      message: expect.stringContaining("super administrateur"),
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("removes the photos, deletes the session's own user, signs out and goes to the login", async () => {
    list.mockResolvedValueOnce({ data: [{ name: "a.webp" }], error: null });
    await expect(deleteMyAccount(IDLE, form("supprimer"))).rejects.toThrow(
      "NEXT_REDIRECT:/login?deleted=1",
    );
    expect(remove).toHaveBeenCalledWith(["user-1/a.webp"]);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the account when the photos cannot be removed", async () => {
    list.mockResolvedValue({ data: null, error: { message: "storage down" } });
    const result = await deleteMyAccount(IDLE, form("SUPPRIMER"));
    expect(result.status).toBe("error");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("tells the person when Auth refuses the deletion, without staying signed in a half state", async () => {
    deleteUser.mockResolvedValue({ error: { code: "unexpected_failure", name: "AuthApiError" } });
    const result = await deleteMyAccount(IDLE, form("SUPPRIMER"));
    expect(result.status).toBe("error");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("still ends on the login when the sign-out call fails after the deletion", async () => {
    signOut.mockRejectedValue(new Error("session already gone"));
    await expect(deleteMyAccount(IDLE, form("SUPPRIMER"))).rejects.toThrow("NEXT_REDIRECT");
  });
});
