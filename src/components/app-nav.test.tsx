import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./app-nav";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

describe("AppNav", () => {
  it("renders the four main sections", () => {
    usePathname.mockReturnValue("/");
    render(<AppNav />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("marks only the current section as active", () => {
    usePathname.mockReturnValue("/messages");
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Messagerie" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });
});
