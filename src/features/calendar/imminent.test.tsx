import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDismissed,
  countdownLabel,
  DISMISSED_STORAGE_KEY,
  isImminent,
  MAX_DISMISSED,
  minutesUntil,
  readDismissed,
} from "./imminent";
import { ImminentBanner, type ImminentEvent } from "./imminent-banner";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const NOW = new Date("2026-10-07T12:00:00Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

describe("countdown helpers", () => {
  it("rounds minutes up and clamps at zero", () => {
    expect(minutesUntil(at(25), NOW)).toBe(25);
    expect(minutesUntil(new Date(NOW + 61_000).toISOString(), NOW)).toBe(2);
    expect(minutesUntil(at(-5), NOW)).toBe(0);
  });

  it("is imminent only between now (excluded) and the window (included)", () => {
    expect(isImminent(at(30), NOW)).toBe(true);
    expect(isImminent(at(31), NOW)).toBe(false);
    expect(isImminent(at(0), NOW)).toBe(false);
    expect(isImminent(at(-1), NOW)).toBe(false);
  });

  it("labels the countdown", () => {
    expect(countdownLabel(at(25), NOW)).toBe("dans 25 min");
    expect(countdownLabel(at(1), NOW)).toBe("dans 1 min");
    expect(countdownLabel(new Date(NOW + 30_000).toISOString(), NOW)).toBe(
      "dans moins d'une minute",
    );
  });
});

describe("dismissed storage", () => {
  const memory = (initial?: string) => {
    let value = initial ?? null;
    return {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next;
      },
    };
  };

  it("reads nothing from a missing, corrupt or wrongly shaped value", () => {
    expect(readDismissed(null)).toEqual([]);
    expect(readDismissed(memory())).toEqual([]);
    expect(readDismissed(memory("not json"))).toEqual([]);
    expect(readDismissed(memory('{"a":1}'))).toEqual([]);
    expect(readDismissed(memory('["a", 3, "b"]'))).toEqual(["a", "b"]);
  });

  it("adds ids once, keeps the most recent ones, and survives a failing storage", () => {
    const store = memory();
    expect(addDismissed(store, "a")).toEqual(["a"]);
    expect(addDismissed(store, "b")).toEqual(["a", "b"]);
    expect(addDismissed(store, "a")).toEqual(["b", "a"]);

    const many = memory(JSON.stringify(Array.from({ length: MAX_DISMISSED }, (_, i) => `id${i}`)));
    const next = addDismissed(many, "new");
    expect(next).toHaveLength(MAX_DISMISSED);
    expect(next.at(-1)).toBe("new");
    expect(next).not.toContain("id0");

    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(addDismissed(broken, "x")).toEqual(["x"]);
  });
});

describe("ImminentBanner", () => {
  const event = (id: string, minutes: number): ImminentEvent => ({
    id,
    title: `Événement ${id}`,
    location: "Place centrale",
    startsAt: at(minutes),
    time: "14:30",
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the imminent events with a countdown and a link to the details", () => {
    render(<ImminentBanner serverNow={NOW} events={[event("e1", 20)]} />);
    expect(screen.getByRole("region", { name: "Événements imminents" })).toBeInTheDocument();
    expect(screen.getByText(/dans 20 min/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Événement e1/ })).toHaveAttribute(
      "href",
      "/calendar/e1",
    );
    expect(screen.getByText(/Place centrale/)).toBeInTheDocument();
  });

  it("can be closed, and stays closed on the next visit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<ImminentBanner serverNow={NOW} events={[event("e1", 20)]} />);
    await user.click(screen.getByRole("button", { name: /Fermer/ }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(DISMISSED_STORAGE_KEY) ?? "[]")).toEqual(["e1"]);

    unmount();
    render(<ImminentBanner serverNow={NOW} events={[event("e1", 20)]} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("only closes the event that was closed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ImminentBanner serverNow={NOW} events={[event("e1", 10), event("e2", 20)]} />);
    await user.click(screen.getByRole("button", { name: "Fermer l'annonce de Événement e1" }));
    expect(screen.queryByText("Événement e1")).toBeNull();
    expect(screen.getByText("Événement e2")).toBeInTheDocument();
  });

  it("disappears when the event starts", () => {
    render(<ImminentBanner serverNow={NOW} events={[event("e1", 1)]} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows nothing for events outside the window", () => {
    render(<ImminentBanner serverNow={NOW} events={[event("e1", 90)]} />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
