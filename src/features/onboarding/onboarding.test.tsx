import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSteps, Onboarding } from "./onboarding";
import { ONBOARDING_STORAGE_KEY } from "./onboarding-store";

vi.mock("@/features/push/actions", () => ({
  savePushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no matchMedia: a browser tab, not an installed app.
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("buildSteps", () => {
  it("always has the welcome and the look, in that order", () => {
    expect(buildSteps({ install: "unavailable", push: false, keepInstall: false })).toEqual([
      "welcome",
      "look",
    ]);
  });

  it("adds the install step where we can help, and notifications where they work", () => {
    expect(buildSteps({ install: "prompt", push: true, keepInstall: false })).toEqual([
      "welcome",
      "install",
      "notifications",
      "look",
    ]);
    expect(buildSteps({ install: "ios", push: false, keepInstall: false })).toContain("install");
  });

  it("drops the install step once installed, unless the person is on it", () => {
    expect(buildSteps({ install: "installed", push: false, keepInstall: false })).not.toContain(
      "install",
    );
    expect(buildSteps({ install: "installed", push: false, keepInstall: true })).toContain(
      "install",
    );
  });
});

describe("Onboarding", () => {
  it("shows nothing once it was finished on this device", () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "2026-10-19");
    render(<Onboarding vapidPublicKey={null} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("walks through the steps, then remembers it is done", async () => {
    const user = userEvent.setup();
    render(<Onboarding vapidPublicKey={null} />);

    expect(document.querySelector("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Bienvenue sur BLOCUS." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retour" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Commencer" }));
    expect(screen.getByRole("heading", { name: "Fais-la à ton image" })).toBeInTheDocument();
    // Last step: no more "Passer".
    expect(screen.queryByRole("button", { name: "Passer" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByRole("heading", { name: "Bienvenue sur BLOCUS." })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Commencer" }));
    await user.click(screen.getByRole("button", { name: "C'est parti" }));
    expect(document.querySelector("dialog")).toBeNull();
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).not.toBeNull();
  });

  it("puts the focus on the title without outlining it, not on a button", () => {
    render(<Onboarding vapidPublicKey={null} />);
    const title = screen.getByRole("heading", { name: "Bienvenue sur BLOCUS." });
    expect(title).toHaveFocus();
    // globals.css hides the focus ring of this attribute: nobody can Tab to the title.
    expect(title).toHaveAttribute("data-focus-silent");
  });

  it("can be skipped from the first step", async () => {
    const user = userEvent.setup();
    render(<Onboarding vapidPublicKey={null} />);
    await user.click(screen.getByRole("button", { name: "Passer" }));
    expect(document.querySelector("dialog")).toBeNull();
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).not.toBeNull();
  });
});
