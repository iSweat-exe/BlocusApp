import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("NotFound", () => {
  it("is titled « Page introuvable », with the big 404 hidden from assistive technologies", () => {
    const { container } = render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeInTheDocument();
    const numeral = container.querySelector('p[aria-hidden="true"]');
    expect(numeral?.textContent).toBe("404");
  });

  it("always leaves a way out: the home page and the map", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Voir la carte" })).toHaveAttribute("href", "/map");
  });

  it("has a touch of personality", () => {
    render(<NotFound />);
    expect(screen.getByText(/perdue dans le cortège/)).toBeInTheDocument();
  });
});
