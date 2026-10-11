import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PROFILE_PAGE_SIZE, type AdminProfile, type Role } from "@/lib/data/profiles";
import { UserListView } from "./user-list";
import { roleTone } from "./role-badge";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ROLES: Role[] = [
  { key: "user", label: "Utilisateur", rank: 10 },
  { key: "moderator", label: "Modérateur", rank: 30 },
  { key: "admin", label: "Administrateur", rank: 40 },
];

const profile = (id: string, pseudo: string, role: string): AdminProfile => ({
  id,
  pseudo,
  avatar_url: null,
  role,
  created_at: "2026-10-01T10:00:00Z",
});

const PROFILES = [
  profile("1", "alice", "admin"),
  profile("2", "bob", "moderator"),
  profile("3", "carol", "user"),
];

function view(over: Partial<React.ComponentProps<typeof UserListView>> = {}) {
  return render(
    <UserListView
      profiles={PROFILES}
      roles={ROLES}
      params={{ search: "", role: null }}
      currentUserId="1"
      {...over}
    />,
  );
}

describe("UserListView", () => {
  it("links each user to their page, with their role as a badge", () => {
    view();
    const rows = within(screen.getByRole("region", { name: "Comptes" })).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/admin/users/1",
      "/admin/users/2",
      "/admin/users/3",
    ]);
    expect(rows[1]).toHaveTextContent("bob");
    expect(rows[1]).toHaveTextContent("Modérateur");
    expect(screen.getByText("3 comptes")).toBeInTheDocument();
  });

  it("no longer carries a role form in the list: roles are changed on the user's page", () => {
    view();
    expect(screen.queryByRole("button", { name: "Appliquer" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("marks the signed-in admin", () => {
    view();
    expect(screen.getAllByText("Toi")).toHaveLength(1);
    expect(screen.getByText("alice").parentElement).toHaveTextContent("Toi");
  });

  it("offers a search that keeps the role filter, and a way to clear it", () => {
    view({ params: { search: "ali", role: "admin" } });
    const search = screen.getByRole("searchbox", { name: "Rechercher un pseudo" });
    expect(search).toHaveValue("ali");
    expect(search.closest("form")?.querySelector('input[name="role"]')).toHaveValue("admin");
    expect(screen.getByRole("link", { name: "Effacer la recherche" })).toHaveAttribute(
      "href",
      "/admin?role=admin",
    );
  });

  it("shows no clear button without a search, but still has a submit for assistive technologies", () => {
    view();
    expect(screen.queryByRole("link", { name: "Effacer la recherche" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeInTheDocument();
  });

  it("filters by role with chips that keep the search, highest role first", () => {
    view({ profiles: [PROFILES[1]!], params: { search: "a", role: "moderator" } });
    const nav = screen.getByRole("navigation", { name: "Filtrer par rôle" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/admin?q=a",
      "/admin?q=a&role=admin",
      "/admin?q=a&role=moderator",
      "/admin?q=a&role=user",
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Modérateur");
    expect(screen.getByText(/1 compte/)).toBeInTheDocument();
  });

  it("warns that the list is cut when it reaches the page size", () => {
    const many = Array.from({ length: PROFILE_PAGE_SIZE }, (_, index) =>
      profile(String(index), `user${index}`, "user"),
    );
    view({ profiles: many });
    expect(screen.getByText(/premiers résultats sont affichés/)).toBeInTheDocument();
  });

  it("explains an empty result for a search, a role, and nobody, with a way back", () => {
    const { unmount } = view({ profiles: [], params: { search: "zzz", role: "admin" } });
    expect(screen.getByText("Aucun compte trouvé")).toBeInTheDocument();
    expect(screen.getByText(/Aucun pseudo ne contient/)).toHaveTextContent("zzz");
    expect(screen.getByText(/parmi les Administrateur/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir tous les comptes" })).toHaveAttribute(
      "href",
      "/admin",
    );
    unmount();

    const second = view({ profiles: [], params: { search: "", role: "moderator" } });
    expect(screen.getByText("Personne n'a le rôle Modérateur.")).toBeInTheDocument();
    second.unmount();

    view({ profiles: [], params: { search: "", role: null } });
    expect(screen.getByText("Aucun compte")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Voir tous les comptes" })).toBeNull();
  });
});

describe("roleTone", () => {
  it("makes the higher roles stand out and leaves an unknown role neutral", () => {
    expect(roleTone("super_admin")).toContain("bg-accent");
    expect(roleTone("admin")).not.toBe(roleTone("user"));
    expect(roleTone("something_new")).toBe(roleTone("user"));
  });

  it("gives every role of the technical and field teams a badge of its own", () => {
    const tones = ["developer", "editor", "relay", "manager", "moderator"].map(roleTone);
    expect(new Set(tones).size).toBe(tones.length);
    expect(tones).not.toContain(roleTone("user"));
  });
});
