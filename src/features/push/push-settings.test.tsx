import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PushSettings } from "./push-settings";

vi.mock("./actions", () => ({ savePushSubscription: vi.fn(), removePushSubscription: vi.fn() }));

afterEach(() => {
  // Back to the jsdom default, defined on the prototype.
  Reflect.deleteProperty(window.navigator, "userAgent");
  vi.unstubAllGlobals();
});

describe("PushSettings", () => {
  it("explains how to install the app on an iPhone, without asking for any permission", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15",
    });
    // jsdom has no matchMedia: not installed to the Home Screen.
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<PushSettings vapidPublicKey="key" />);
    expect(await screen.findByRole("note")).toHaveTextContent("écran d'accueil");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says so when the browser cannot receive notifications (also the case in development)", async () => {
    render(<PushSettings vapidPublicKey="key" />);
    expect(await screen.findByRole("note")).toHaveTextContent("ne permet pas");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
