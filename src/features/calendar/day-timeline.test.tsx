import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DayEvent } from "./calendar-types";
import { detailFor } from "./day-event-block";
import { DayTimeline } from "./day-timeline";
import { DAY_HEIGHT_PX, hourToPx } from "./timeline";

let clock: number | null = null;
vi.mock("./use-minute-clock", () => ({ useMinuteClock: () => clock }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const event = (
  id: string,
  startHour: number,
  endHour: number | undefined,
  extra: Partial<DayEvent> = {},
): DayEvent => {
  const hh = String(Math.floor(startHour)).padStart(2, "0");
  const mm = String(Math.round((startHour % 1) * 60)).padStart(2, "0");
  return {
    id,
    title: `Événement ${id}`,
    location: "",
    time: endHour === undefined ? `${hh}:${mm}` : `${hh}:${mm} – fin`,
    finished: false,
    startHour,
    ...(endHour === undefined ? {} : { endHour }),
    startTime: `${hh}:${mm}`,
    ...extra,
  };
};

const DAY = "2026-10-20";

beforeEach(() => {
  clock = null;
});

describe("detailFor", () => {
  it("shows one line in a short block, the time in a medium one, the place in a tall one", () => {
    expect(detailFor(28, 1)).toBe("title");
    expect(detailFor(40, 1)).toBe("time");
    expect(detailFor(120, 1)).toBe("full");
  });

  it("drops the place when blocks share the width, and the time when three or more do", () => {
    expect(detailFor(120, 2)).toBe("full");
    expect(detailFor(120, 3)).toBe("time");
  });
});

describe("DayTimeline", () => {
  it("is the whole day as a scrollable region, one labelled line per hour", () => {
    render(<DayTimeline day={DAY} today="2026-10-21" events={[]} />);
    const region = screen.getByRole("region", { name: /mardi 20 octobre 2026 sur 24 heures/ });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toContain("overflow-y-auto");
    for (const label of ["00:00", "09:00", "23:00"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/^\d\d:00$/)).toHaveLength(24);
  });

  it("opens an hour before the first event", () => {
    render(<DayTimeline day={DAY} today="2026-10-21" events={[event("a", 14, 15)]} />);
    const region = screen.getByRole("region");
    expect(region.scrollTop).toBe(hourToPx(13));
  });

  it("says so, in the visible part, when there is nothing that day", () => {
    const { container } = render(<DayTimeline day={DAY} today="2026-10-21" events={[]} />);
    expect(screen.getByText("Aucun événement prévu ce jour")).toBeInTheDocument();
    expect(container.querySelector("[data-empty-day]")).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("puts overlapping events side by side, each on its share of the width", () => {
    render(
      <DayTimeline
        day={DAY}
        today="2026-10-21"
        events={[event("a", 9, 11), event("b", 10, 12), event("c", 15, 16)]}
      />,
    );
    const a = screen.getByRole("link", { name: /Événement a/ });
    const b = screen.getByRole("link", { name: /Événement b/ });
    const c = screen.getByRole("link", { name: /Événement c/ });
    expect(a).toHaveAttribute("data-column", "0");
    expect(a).toHaveAttribute("data-columns", "2");
    expect(b).toHaveAttribute("data-column", "1");
    expect(b).toHaveAttribute("data-columns", "2");
    // The third overlaps nothing: the whole width.
    expect(c).toHaveAttribute("data-columns", "1");
  });

  it("draws an event with no end as a block of one hour with its start time alone", () => {
    render(<DayTimeline day={DAY} today="2026-10-21" events={[event("a", 14, undefined)]} />);
    const block = screen.getByRole("link", { name: /Événement a/ });
    // One hour of the 24 is 4.17 % of the timeline (56 px).
    expect(block.style.height).toContain("4.1666");
    expect(block).toHaveTextContent("14:00");
    expect(block).not.toHaveTextContent("fin");
  });

  it("colours each block with its own hue, and greys a finished event", () => {
    render(
      <DayTimeline
        day={DAY}
        today="2026-10-21"
        events={[event("a", 9, 10), event("b", 11, 12), event("c", 13, 14, { finished: true })]}
      />,
    );
    const a = screen.getByRole("link", { name: /Événement a/ });
    const b = screen.getByRole("link", { name: /Événement b/ });
    const c = screen.getByRole("link", { name: /Événement c/ });
    expect(a.style.borderLeft).toContain("oklch");
    expect(a.style.borderLeft).not.toBe(b.style.borderLeft);
    expect(c.style.borderLeft).not.toContain("oklch");
    expect(within(c).getByText("Événement c")).toHaveClass("line-through");
  });

  it("writes the exact start in the left strip, and only the first of two starts that would clash", () => {
    const { container } = render(
      <DayTimeline
        day={DAY}
        today="2026-10-21"
        events={[event("a", 9, 10), event("b", 9.1, 10), event("c", 12, 13)]}
      />,
    );
    const marker = (time: string) => container.querySelector(`[data-start-marker="${time}"]`)!;
    expect(marker("09:00")).toHaveAttribute("aria-hidden", "true");
    expect(marker("09:00").firstElementChild).not.toHaveClass("opacity-0");
    expect(marker("09:06").firstElementChild).toHaveClass("opacity-0");
    expect(marker("12:00").firstElementChild).not.toHaveClass("opacity-0");
  });

  it("hides the hour label under a written start time", () => {
    render(<DayTimeline day={DAY} today="2026-10-21" events={[event("a", 12, 13)]} />);
    expect(screen.getByText("12:00", { selector: "span[class*='text-muted']" })).toHaveClass(
      "opacity-0",
    );
    expect(screen.getByText("11:00")).not.toHaveClass("opacity-0");
  });

  it("shows the current time on today only, once the clock is known", () => {
    // 14:30 in Paris.
    clock = new Date("2026-10-20T12:30:00Z").getTime();
    const { container, rerender } = render(<DayTimeline day={DAY} today={DAY} events={[]} />);
    const now = container.querySelector("[data-now-line]") as HTMLElement;
    expect(now).not.toBeNull();
    expect(now).toHaveTextContent("14:30");
    expect(now.style.top).toBe(`${hourToPx(14.5)}px`);

    rerender(<DayTimeline day={DAY} today="2026-10-21" events={[]} />);
    expect(container.querySelector("[data-now-line]")).toBeNull();

    // On the server and during hydration the clock is unknown: nothing is drawn that the server did not draw.
    clock = null;
    rerender(<DayTimeline day={DAY} today={DAY} events={[]} />);
    expect(container.querySelector("[data-now-line]")).toBeNull();
  });

  it("is as tall as 24 hours of 56 px", () => {
    const { container } = render(<DayTimeline day={DAY} today="2026-10-21" events={[]} />);
    expect(DAY_HEIGHT_PX).toBe(24 * 56);
    expect(container.querySelector(`div[style*="height: ${DAY_HEIGHT_PX}px"]`)).not.toBeNull();
  });
});
