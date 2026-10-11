import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditsLink } from "./credits-link";

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
  }: {
    href: string;
    prefetch?: boolean;
    children: React.ReactNode;
  }) => (
    <a href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

describe("CreditsLink", () => {
  it("leads to the credits and says what they are for", () => {
    render(<CreditsLink />);
    const link = screen.getByRole("link", { name: /Crédits/ });
    expect(link).toHaveAttribute("href", "/credits");
    expect(link).toHaveTextContent("Qui a développé BLOCUS.");
  });

  it("does not preload the page: a link that is rarely used must not cost a request per screen", () => {
    render(<CreditsLink />);
    expect(screen.getByRole("link")).toHaveAttribute("data-prefetch", "false");
  });
});
