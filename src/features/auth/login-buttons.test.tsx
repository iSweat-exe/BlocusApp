import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoogleButton } from "./google-button";
import { GuestLink } from "./guest-link";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("GoogleButton", () => {
  it("links to the route that starts the Google sign-in", () => {
    render(<GoogleButton />);
    expect(screen.getByRole("link", { name: /Continuer avec Google/ })).toHaveAttribute(
      "href",
      "/auth/login/google",
    );
  });
});

describe("GuestLink", () => {
  it("lets visitors browse the app read-only from the home page", () => {
    render(<GuestLink />);
    expect(screen.getByRole("link", { name: /invité/ })).toHaveAttribute("href", "/");
  });
});
