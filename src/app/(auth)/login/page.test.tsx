import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The Discord button resolves the provider URL over the network: its own test covers that.
vi.mock("@/features/auth/discord-button", () => ({
  DiscordButton: () => <a href="/auth/login/discord">Continuer avec Discord</a>,
}));

describe("LoginPage", () => {
  it("is titled « Connexion » for assistive technologies, while the visible brand is hidden from them", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Connexion" })).toHaveClass("sr-only");
    const brand = screen.getByText(/^BLOCUS/);
    expect(brand).toHaveAttribute("aria-hidden", "true");
  });

  it("offers Discord, Google and the guest mode", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /Discord/ })).toHaveAttribute(
      "href",
      "/auth/login/discord",
    );
    expect(screen.getByRole("link", { name: /Google/ })).toHaveAttribute(
      "href",
      "/auth/login/google",
    );
    expect(screen.getByRole("link", { name: /invité/ })).toHaveAttribute("href", "/");
  });

  it("scrolls on a short screen: a minimum height, never a fixed one or a hidden overflow", () => {
    const { container } = render(<LoginPage />);
    const column = container.querySelector(".min-h-dvh");
    expect(column).not.toBeNull();
    const classes = (column?.className ?? "").split(/\s+/);
    for (const forbidden of ["h-dvh", "max-h-dvh", "overflow-hidden"]) {
      expect(classes).not.toContain(forbidden);
    }
  });

  it("draws its background with CSS only: no image to download", () => {
    const { container } = render(<LoginPage />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".accent-glow")).toHaveAttribute("aria-hidden", "true");
  });
});
