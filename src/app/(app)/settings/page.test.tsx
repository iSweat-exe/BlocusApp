import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The pickers store their choice on the device and the account section reads the session: their own tests cover them.
vi.mock("@/features/settings/accent-picker", () => ({ AccentPicker: () => <p>accent</p> }));
vi.mock("@/features/settings/theme-picker", () => ({ ThemePicker: () => <p>thème</p> }));
vi.mock("@/features/settings/account-section", () => ({ AccountSection: () => null }));

describe("SettingsPage", () => {
  it("shows the credits to everybody, in a section of its own that does not depend on the account", () => {
    render(<SettingsPage />);
    const about = screen.getByRole("region", { name: "À propos" });
    expect(about).toContainElement(screen.getByRole("link", { name: /Crédits/ }));
    expect(screen.getByRole("link", { name: /Crédits/ })).toHaveAttribute("href", "/credits");
  });

  it("links the patch notes from the same public section", () => {
    render(<SettingsPage />);
    const about = screen.getByRole("region", { name: "À propos" });
    expect(about).toContainElement(screen.getByRole("link", { name: /Patch notes/ }));
    expect(screen.getByRole("link", { name: /Patch notes/ })).toHaveAttribute(
      "href",
      "/patch-notes",
    );
  });
});
