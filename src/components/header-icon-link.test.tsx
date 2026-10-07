import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderIconLink } from "./header-icon-link";

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

describe("HeaderIconLink", () => {
  it("is named by its label and points at its section", () => {
    usePathname.mockReturnValue("/");
    render(
      <HeaderIconLink href="/profil" label="Mon profil">
        <svg />
      </HeaderIconLink>,
    );
    const link = screen.getByRole("link", { name: "Mon profil" });
    expect(link).toHaveAttribute("href", "/profil");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks the current section, including its sub-pages, but not look-alike paths", () => {
    const renderAt = (pathname: string) => {
      usePathname.mockReturnValue(pathname);
      const { unmount } = render(
        <HeaderIconLink href="/admin" label="Administration">
          <svg />
        </HeaderIconLink>,
      );
      const current = screen.getByRole("link").getAttribute("aria-current");
      unmount();
      return current;
    };
    expect(renderAt("/admin")).toBe("page");
    expect(renderAt("/admin/users/123")).toBe("page");
    expect(renderAt("/administrators")).toBeNull();
    expect(renderAt("/profil")).toBeNull();
  });
});
