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

describe("icons of the login buttons", () => {
  it("gives the Google and guest buttons a decorative icon that does not change their name", () => {
    render(
      <>
        <GoogleButton />
        <GuestLink />
      </>,
    );
    for (const name of [/^Continuer avec Google$/, /^Continuer en tant qu'invité$/]) {
      const icon = screen.getByRole("link", { name }).querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("focusable", "false");
    }
  });
});

describe("GuestLink", () => {
  it("lets visitors browse the app read-only from the home page", () => {
    render(<GuestLink />);
    expect(screen.getByRole("link", { name: /invité/ })).toHaveAttribute("href", "/");
  });
});
