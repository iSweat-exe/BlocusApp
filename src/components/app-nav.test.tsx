import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./app-nav";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

describe("AppNav", () => {
  it("renders the three main sections", () => {
    usePathname.mockReturnValue("/");
    render(<AppNav />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("marks only the current section as active", () => {
    usePathname.mockReturnValue("/calendar");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Calendrier" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });

  it("gives every item an icon above its label, and a comfortable touch target", () => {
    usePathname.mockReturnValue("/");
    render(<AppNav />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("svg")).not.toBeNull();
      expect(link.className).toContain("min-h-16");
    }
    expect(screen.getByRole("navigation", { name: "Navigation principale" }).className).toContain(
      "safe-area-inset-bottom",
    );
  });

  it("matches nested routes (the calendar detail keeps Calendrier active)", () => {
    usePathname.mockReturnValue("/calendar/00000000-0000-0000-0000-000000000001");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Calendrier" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });

  it("has no link to the removed messages page", () => {
    usePathname.mockReturnValue("/");
    render(<AppNav />);
    expect(screen.queryByRole("link", { name: "Messagerie" })).toBeNull();
  });
});
