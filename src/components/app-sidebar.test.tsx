import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar, AppSidebarFallback } from "./app-sidebar";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

describe("AppSidebar", () => {
  it("is shown from 1024 px only, and lists the four sections", () => {
    usePathname.mockReturnValue("/");
    render(<AppSidebar />);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(nav.closest("aside")?.className ?? nav.className).toMatch(/\bhidden\b.*\blg:flex\b/);
    expect(screen.getAllByRole("link", { name: /Accueil|Calendrier|Carte|Réglages/ })).toHaveLength(
      4,
    );
  });

  it("marks the current section, nested routes included", () => {
    usePathname.mockReturnValue("/calendar/0001");
    render(<AppSidebar />);
    expect(screen.getByRole("link", { name: "Calendrier" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the legal links within reach", () => {
    usePathname.mockReturnValue("/");
    render(<AppSidebar />);
    for (const name of ["Crédits", "Confidentialité", "Conditions"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("reserves the same width while loading (desktop only)", () => {
    const { container } = render(<AppSidebarFallback />);
    expect(container.firstElementChild?.className).toContain("w-64");
  });
});

describe("the bottom bar", () => {
  it("is hidden on a desktop", async () => {
    usePathname.mockReturnValue("/");
    const { AppNav } = await import("./app-nav");
    render(<AppNav />);
    expect(screen.getByRole("navigation", { name: "Navigation principale" }).className).toContain(
      "lg:hidden",
    );
  });
});
