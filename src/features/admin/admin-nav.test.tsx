import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeAdminHref, AdminNav, type AdminLink } from "./admin-nav";
import { adminLinksFor } from "./admin-links";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => usePathname.mockReset());

const LINKS: AdminLink[] = adminLinksFor([
  "role.assign",
  "permission.manage",
  "audit.read",
  "monitoring.view",
]);

describe("activeAdminHref", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/users/abc", "/admin"],
    ["/admin/roles", "/admin/roles"],
    ["/admin/journal", "/admin/journal"],
    ["/admin/health", "/admin/health"],
    ["/admin/journal/anything", "/admin/journal"],
  ])("puts %s under %s", (pathname, expected) => {
    expect(activeAdminHref(pathname, LINKS)).toBe(expected);
  });

  it("does not take a look-alike path for a section, and knows nothing outside the area", () => {
    expect(activeAdminHref("/admin/rolesx", LINKS)).toBeUndefined();
    expect(activeAdminHref("/profil", LINKS)).toBeUndefined();
  });

  it("does not mark a section the user cannot see", () => {
    expect(activeAdminHref("/admin/roles", adminLinksFor([]))).toBeUndefined();
  });
});

describe("AdminNav", () => {
  it("lists the sections the permissions allow, with a short label and an icon each", () => {
    usePathname.mockReturnValue("/admin");
    render(<AdminNav links={LINKS} />);
    const nav = screen.getByRole("navigation", { name: "Sections de l'administration" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Utilisateurs",
      "Rôles",
      "Journal",
      "Santé",
    ]);
    for (const link of links) expect(link.querySelector("svg")).not.toBeNull();
  });

  it("marks the current section, and keeps a user page under « Utilisateurs »", () => {
    usePathname.mockReturnValue("/admin/users/00000000-0000-0000-0000-000000000001");
    render(<AdminNav links={LINKS} />);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent("Utilisateurs");
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("shows only « Utilisateurs » to someone with no other section", () => {
    usePathname.mockReturnValue("/admin");
    render(<AdminNav links={adminLinksFor(["user.ban"])} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
