import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPermissions } from "@/server/session";
import { ProfileView } from "./profile-view";

const getProfile = vi.fn();
vi.mock("@/lib/data/profiles", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  listRoles: async () => ({ ok: true, value: [{ key: "member", label: "Membre" }] }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const session: SessionPermissions = {
  userId: "u1",
  role: "member",
  permissions: [],
  email: "a@b.fr",
  providers: ["discord", "google"],
  avatarUrl: null,
};

beforeEach(() => {
  getProfile.mockResolvedValue({
    ok: true,
    value: {
      id: "u1",
      pseudo: "Alice",
      avatar_url: null,
      role: "member",
      created_at: "2026-01-02T10:00:00Z",
    },
  });
});

describe("ProfileView", () => {
  it("shows identity, account details and a sign-out button", async () => {
    render(await ProfileView({ session }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Membre")).toBeInTheDocument();
    expect(screen.getByText("a@b.fr")).toBeInTheDocument();
    expect(screen.getByText("Discord, Google")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Déconnexion" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Administration/ })).toBeNull();
  });

  it("offers the Administration link only with an admin permission", async () => {
    render(await ProfileView({ session: { ...session, permissions: ["audit.read"] } }));
    expect(screen.getByRole("link", { name: /Administration/ })).toHaveAttribute("href", "/admin");
  });

  it("shows an alert when the profile cannot be loaded", async () => {
    getProfile.mockResolvedValue({ ok: false });
    render(await ProfileView({ session }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
