import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EVENT_STORAGE_KEY } from "./event";
import { EventToggle } from "./event-toggle";
import { EventDecor } from "./event-decor";
import { HalloweenDecor } from "./halloween-decor";

const root = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  root.removeAttribute("data-event");
});

afterEach(() => {
  root.removeAttribute("data-event");
});

describe("HalloweenDecor", () => {
  it("shows ghosts, a pumpkin and sweets, hidden from assistive technologies and from taps", () => {
    render(<HalloweenDecor />);
    const decor = screen.getByTestId("halloween-decor");
    expect(decor).toHaveAttribute("aria-hidden", "true");
    expect(decor).toHaveClass("pointer-events-none");
    expect(decor.querySelectorAll(".halloween-bob").length).toBeGreaterThanOrEqual(3);
    // Ghosts zigzag; few things fly, so the page stays easy to read.
    expect(decor.querySelectorAll(".halloween-zig").length).toBeGreaterThanOrEqual(3);
    expect(decor.querySelectorAll("[data-react]").length).toBeLessThanOrEqual(12);
    expect(decor.querySelectorAll(".halloween-fall").length).toBeGreaterThanOrEqual(4);
    // No bats, no lollipops any more.
    expect(decor.querySelector(".halloween-flap")).toBeNull();
  });

  it("keeps the cobweb and its spider in front of the page, in the corner, out of the way of taps", () => {
    render(<HalloweenDecor />);
    const corner = screen.getByTestId("halloween-corner");
    expect(corner).toHaveAttribute("aria-hidden", "true");
    expect(corner).toHaveClass("pointer-events-none", "z-40");
    expect(corner.querySelector(".halloween-cobweb")).not.toBeNull();
    expect(corner.querySelector(".halloween-swing")).not.toBeNull();
    // The rest is behind the page.
    expect(screen.getByTestId("halloween-decor")).toHaveClass("-z-10");
    expect(screen.getByTestId("halloween-decor").querySelector(".halloween-cobweb")).toBeNull();
  });
});

describe("EventDecor", () => {
  it("renders nothing while no event runs, and does not even load the decoration", () => {
    render(<EventDecor />);
    expect(screen.queryByTestId("halloween-decor")).toBeNull();
  });

  it("loads and shows the decoration when the event is switched on, and removes it when switched off", async () => {
    render(<EventDecor />);
    await act(async () => root.setAttribute("data-event", "halloween"));
    expect(await screen.findByTestId("halloween-decor")).toBeInTheDocument();
    await act(async () => root.removeAttribute("data-event"));
    expect(screen.queryByTestId("halloween-decor")).toBeNull();
  });
});

describe("EventToggle", () => {
  it("is not shown outside an event", () => {
    render(<EventToggle />);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("switches the event off and back on, and remembers it on this device", async () => {
    const user = userEvent.setup();
    root.setAttribute("data-event", "halloween");
    render(<EventToggle />);

    const toggle = screen.getByRole("switch", { name: /Thème Halloween/ });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(root.hasAttribute("data-event")).toBe(false);
    expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBe("off");
    // Still there, to turn it back on.
    expect(screen.getByRole("switch", { name: /Thème Halloween/ })).not.toBeChecked();

    await user.click(screen.getByRole("switch", { name: /Thème Halloween/ }));
    expect(root.getAttribute("data-event")).toBe("halloween");
    expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBe("halloween");
  });
});
