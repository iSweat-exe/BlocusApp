import { act, render, screen } from "@testing-library/react";
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
    // Clears the iPhone home indicator and the Android gesture bar (which often reports no safe area).
    expect(screen.getByRole("navigation", { name: "Navigation principale" }).className).toContain(
      "pb-safe-bottom",
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

  it("plays the tap animation on the icon of the tapped item only, then stops", () => {
    vi.useFakeTimers();
    try {
      usePathname.mockReturnValue("/");
      render(<AppNav />);
      const icon = (name: string) => screen.getByRole("link", { name }).querySelector("svg");
      expect(icon("Réglages")?.getAttribute("class")).not.toContain("animate-");

      act(() => screen.getByRole("link", { name: "Réglages" }).click());
      expect(icon("Réglages")?.getAttribute("class")).toContain("animate-gear-spin");
      expect(icon("Accueil")?.getAttribute("class")).not.toContain("animate-");

      act(() => vi.advanceTimersByTime(700));
      expect(icon("Réglages")?.getAttribute("class")).not.toContain("animate-");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not update its state after it has been unmounted", () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      usePathname.mockReturnValue("/");
      const { unmount } = render(<AppNav />);
      act(() => screen.getByRole("link", { name: "Carte" }).click());
      unmount();
      act(() => vi.advanceTimersByTime(700));
      expect(error).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });

  it("has no link to the removed messages page", () => {
    usePathname.mockReturnValue("/");
    render(<AppNav />);
    expect(screen.queryByRole("link", { name: "Messagerie" })).toBeNull();
  });
});
