import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPermissions } from "@/server/session";
import { profileThemeOf } from "./profile-theme";
import { ProfileView } from "./profile-view";

const THEMED_ID = "c19db495-1252-4698-af47-819c4240fd48";
// Read from the theme, not copied: the line under the pseudo is meant to be rewritten by whoever owns it.
const themeMessage = () => profileThemeOf(THEMED_ID)!.message;

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

  it("leads to the credits, which a signed-in user can open like anybody else", async () => {
    render(await ProfileView({ session }));
    expect(screen.getByRole("link", { name: /Crédits/ })).toHaveAttribute("href", "/credits");
  });

  it("has no special look for an ordinary profile", async () => {
    const { container } = render(await ProfileView({ session }));
    expect(container.querySelector("[data-profile-theme]")).toBeNull();
    expect(screen.queryByTestId("love-hearts")).toBeNull();
    expect(screen.queryByText(themeMessage())).toBeNull();
  });

  it("gives the love theme to the profile that has one: accent, hearts and a line under the pseudo", async () => {
    getProfile.mockResolvedValue({
      ok: true,
      value: {
        id: THEMED_ID,
        pseudo: "Alice",
        avatar_url: null,
        role: "member",
        created_at: "2026-01-02T10:00:00Z",
      },
    });
    const { container } = render(await ProfileView({ session: { ...session, userId: THEMED_ID } }));

    const themed = container.querySelector("[data-profile-theme]");
    expect(themed).toHaveAttribute("data-profile-theme", "love");
    expect((themed as HTMLElement).style.getPropertyValue("--accent")).toBe("#ec4899");
    expect(screen.getByText(themeMessage())).toBeInTheDocument();
    // Decoration only: hidden from assistive technologies, and the real content is still there.
    expect(screen.getByTestId("love-hearts")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".love-ring")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Déconnexion" })).toBeInTheDocument();
  });

  it("shows an alert when the profile cannot be loaded", async () => {
    getProfile.mockResolvedValue({ ok: false });
    render(await ProfileView({ session }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
