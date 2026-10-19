import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPermissions } from "@/server/session";
import { UserDetail } from "./user-detail";

const getProfile = vi.fn();
const listRoles = vi.fn();
const listSanctions = vi.fn();
const getSignupOrigin = vi.fn();
const getLastSeen = vi.fn();

vi.mock("@/lib/data/profiles", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  listRoles: () => listRoles(),
}));
vi.mock("@/lib/data/sanctions", () => ({
  listSanctions: (...args: unknown[]) => listSanctions(...args),
}));
vi.mock("@/lib/data/signup-origins", () => ({
  getSignupOrigin: (...args: unknown[]) => getSignupOrigin(...args),
}));
vi.mock("@/lib/data/last-seen", () => ({
  getLastSeen: (...args: unknown[]) => getLastSeen(...args),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
// Server actions and the heavy sections are covered elsewhere.
vi.mock("./actions", () => ({ changeRole: vi.fn() }));
vi.mock("./sanction-actions", () => ({ liftSanction: vi.fn() }));
vi.mock("./ban-form", () => ({ BanForm: () => <p>ban form</p> }));
vi.mock("./user-permissions", () => ({ UserPermissions: () => <p>user permissions</p> }));

const ROLES = [
  { key: "user", label: "Utilisateur", rank: 10 },
  { key: "moderator", label: "Modérateur", rank: 30 },
  { key: "admin", label: "Administrateur", rank: 40 },
];

const session = (over: Partial<SessionPermissions> = {}): SessionPermissions => ({
  userId: "admin-1",
  role: "admin",
  permissions: ["role.assign", "user.ban"],
  email: null,
  providers: [],
  avatarUrl: null,
  ...over,
});

function profile(role: string, id = "target-1") {
  getProfile.mockResolvedValue({
    ok: true,
    value: { id, pseudo: "bob", avatar_url: null, role, created_at: "2026-10-01T10:00:00Z" },
  });
}

async function show(sessionOver: Partial<SessionPermissions> = {}, id = "target-1") {
  render(await UserDetail({ id, session: session(sessionOver) }));
}

beforeEach(() => {
  getProfile.mockReset();
  listRoles.mockResolvedValue({ ok: true, value: ROLES });
  listSanctions.mockResolvedValue({ ok: true, value: [] });
  getSignupOrigin.mockReset();
  getSignupOrigin.mockResolvedValue({ ok: true, value: null });
});

describe("UserDetail: changing the role", () => {
  it("offers it to someone who may assign roles, for a user ranking below them", async () => {
    profile("user");
    await show();
    expect(screen.getByRole("heading", { level: 3, name: "Rôle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeInTheDocument();
    expect(document.querySelector('input[name="target"]')).toHaveValue("target-1");
    expect(document.querySelector('input[name="role"]')).toHaveValue("user");
  });

  it("shows the role as a badge in the header", async () => {
    profile("moderator");
    await show();
    expect(screen.getByRole("heading", { level: 2, name: "bob" })).toBeInTheDocument();
    expect(screen.getAllByText("Modérateur").length).toBeGreaterThan(0);
  });

  it("does not offer it without the permission to assign roles", async () => {
    profile("user");
    await show({ permissions: ["user.ban"] });
    expect(screen.queryByRole("heading", { name: "Rôle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Appliquer" })).toBeNull();
  });

  it("does not offer it for a user at the caller's level or above", async () => {
    profile("admin");
    await show();
    expect(screen.queryByRole("button", { name: "Appliquer" })).toBeNull();
    expect(screen.getByText(/Tu ne peux pas sanctionner cet utilisateur/)).toBeInTheDocument();
  });

  it("never offers it on one's own page", async () => {
    profile("user", "admin-1");
    await show({}, "admin-1");
    expect(screen.queryByRole("button", { name: "Appliquer" })).toBeNull();
  });
});

describe("UserDetail: sign-up origin", () => {
  const withOrigin = { permissions: ["role.assign", "user.origin.view"] };

  it("shows where the user signed up from to someone holding user.origin.view", async () => {
    profile("user");
    getSignupOrigin.mockResolvedValue({
      ok: true,
      value: { country: "FR", region: "ARA", city: "Lyon" },
    });
    await show(withOrigin);
    expect(getSignupOrigin).toHaveBeenCalledWith("target-1");
    expect(
      screen.getByRole("heading", { level: 3, name: "Origine de l'inscription" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lyon, France")).toBeInTheDocument();
    expect(screen.getByText("Région : ARA")).toBeInTheDocument();
  });

  it("says so when the origin is unknown", async () => {
    profile("user");
    await show(withOrigin);
    expect(screen.getByText(/Inconnue/)).toBeInTheDocument();
  });

  it("reports a failed read", async () => {
    profile("user");
    getSignupOrigin.mockResolvedValue({ ok: false, error: "load_failed" });
    await show(withOrigin);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger l'origine");
  });

  it("neither shows nor reads it without the permission", async () => {
    profile("user");
    await show();
    expect(getSignupOrigin).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Origine de l'inscription" })).toBeNull();
  });
});

describe("UserDetail: last activity", () => {
  const withActivity = { permissions: ["role.assign", "user.activity.view"] };
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  it("shows « En ligne » for a user seen a minute ago", async () => {
    profile("user");
    getLastSeen.mockResolvedValue({ ok: true, value: minutesAgo(1) });
    await show(withActivity);
    expect(getLastSeen).toHaveBeenCalledWith("target-1");
    expect(screen.getByText("En ligne")).toBeInTheDocument();
  });

  it("shows « Hors ligne » with how long ago", async () => {
    profile("user");
    getLastSeen.mockResolvedValue({ ok: true, value: minutesAgo(3 * 60) });
    await show(withActivity);
    expect(screen.getByText("Hors ligne · il y a 3 heures")).toBeInTheDocument();
  });

  it("says so when the user was never seen", async () => {
    profile("user");
    getLastSeen.mockResolvedValue({ ok: true, value: null });
    await show(withActivity);
    expect(screen.getByText(/dernière activité inconnue/)).toBeInTheDocument();
  });

  it("reports a failed read", async () => {
    profile("user");
    getLastSeen.mockResolvedValue({ ok: false, error: "load_failed" });
    await show(withActivity);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de charger la dernière activité",
    );
  });

  it("neither shows nor reads it without the permission", async () => {
    profile("user");
    await show();
    expect(getLastSeen).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Dernière activité")).toBeNull();
  });
});
