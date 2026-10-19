import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeEventBounds, MonthView, startMarkersOf, type DayEvent } from "./month-view";

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
vi.mock("@/components/full-screen-dialog", () => ({
  FullScreenDialog: ({ triggerLabel }: { triggerLabel: string }) => <button>{triggerLabel}</button>,
}));
vi.mock("./event-form", () => ({ EventForm: () => null }));

const exam: DayEvent = {
  id: "e1",
  title: "Révision maths",
  location: "Salle B",
  time: "14:00 – 16:00",
  finished: false,
};
const eventsByDay = { "2026-10-07": [exam] };

function renderMonth(props: Partial<React.ComponentProps<typeof MonthView>> = {}) {
  return render(
    <MonthView
      month="2026-10"
      initialDay="2026-10-07"
      today="2026-10-07"
      canCreateEvents={false}
      loadFailed={false}
      eventsByDay={eventsByDay}
      {...props}
    />,
  );
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("MonthView", () => {
  it("renders page title and view switcher on the top line", () => {
    renderMonth();
    expect(screen.getByRole("heading", { level: 1, name: "Calendrier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Changer de vue/ })).toBeInTheDocument();
  });

  it("shows the events of the initial day", () => {
    renderMonth();
    expect(
      screen.getByRole("heading", { level: 3, name: "mercredi 7 octobre 2026" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Révision maths/ });
    expect(link).toHaveAttribute("href", "/calendar/e1");
    // A list of links must not prefetch one page per row.
    expect(link).toHaveAttribute("data-prefetch", "false");
  });

  it("switches day on the client and keeps the URL shareable, without navigating", async () => {
    const user = userEvent.setup();
    renderMonth();
    const grid = screen.getByRole("grid", { name: /^Calendrier/ });
    await user.click(within(grid).getByRole("gridcell", { name: /^jeudi 8 octobre 2026/ }));
    expect(
      screen.getByRole("heading", { level: 3, name: "jeudi 8 octobre 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Journée tranquille")).toBeInTheDocument();
    expect(screen.getByText("Rien de prévu ce jour-là.")).toBeInTheDocument();
    expect(window.location.search).toBe("?view=month&month=2026-10&day=2026-10-08");

    const updatedGrid = screen.getByRole("grid", { name: /^Calendrier/ });
    await user.click(
      within(updatedGrid).getByRole("gridcell", { name: /^mercredi 7 octobre 2026/ }),
    );
    expect(screen.getByRole("link", { name: /Révision maths/ })).toBeInTheDocument();
  });

  it("counts events in the cell labels and marks the selected day", () => {
    renderMonth();
    const cell = screen.getByRole("gridcell", { name: "mercredi 7 octobre 2026, 1 événement" });
    expect(cell).toHaveAttribute("aria-selected", "true");
    expect(cell).toHaveAttribute("aria-current", "date");
  });

  it("switches to week view via view switcher and renders 7-day strip with week overview", async () => {
    const user = userEvent.setup();
    renderMonth();

    await user.click(screen.getByRole("button", { name: /Changer de vue/ }));
    await user.click(screen.getByRole("menuitem", { name: "Semaine" }));

    expect(screen.getByRole("heading", { level: 2, name: "Semaine 41" })).toBeInTheDocument();
    expect(window.location.search).toBe("?view=week&week=2026-41&day=2026-10-07");

    const weekGrid = screen.getByRole("grid", { name: "Jours de la semaine" });
    const cells = within(weekGrid).getAllByRole("gridcell");
    expect(cells).toHaveLength(7);

    // Event block inside the Wednesday vertical bar
    const eventLink = within(cells[2]!).getByRole("link", { name: /Révision maths/ });
    expect(eventLink).toHaveAttribute("href", "/calendar/e1");

    // Click on another day in week view
    await user.click(cells[3]!);
    expect(window.location.search).toBe("?view=week&week=2026-41&day=2026-10-08");
  });

  it("switches to day view via view switcher and renders hourly timeline", async () => {
    const user = userEvent.setup();
    renderMonth();

    await user.click(screen.getByRole("button", { name: /Changer de vue/ }));
    await user.click(screen.getByRole("menuitem", { name: "Jour" }));

    expect(window.location.search).toBe("?view=day&day=2026-10-07");
    expect(
      screen.getByRole("heading", { level: 2, name: "mercredi 7 octobre 2026" }),
    ).toBeInTheDocument();

    // The whole day, from midnight to midnight, with an hour every six hours.
    expect(screen.getByLabelText(/sur 24 heures/)).toBeInTheDocument();
    expect(screen.getAllByText("00:00")).toHaveLength(2);
    expect(screen.getByText("06:00")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();

    // Event block spanning its hours
    const dayEventLinks = screen.getAllByRole("link", { name: /Révision maths/ });
    expect(dayEventLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("offers event creation only with the permission and not in the past", async () => {
    const user = userEvent.setup();
    const { unmount } = renderMonth({ canCreateEvents: false });
    expect(screen.queryByRole("button", { name: "Ajouter un événement" })).toBeNull();
    unmount();

    renderMonth({ canCreateEvents: true });
    expect(screen.getByRole("button", { name: "Ajouter un événement" })).toBeInTheDocument();
    await user.click(screen.getByRole("gridcell", { name: /^mardi 6 octobre 2026/ }));
    expect(screen.queryByRole("button", { name: "Ajouter un événement" })).toBeNull();
  });

  it("shows an alert when the events could not be loaded", () => {
    renderMonth({ loadFailed: true, eventsByDay: {} });
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger");
  });

  it("computes event bounds with default 7h30 start and 18h00 end when undefined", () => {
    // Both undefined: default 7h30 to 18h
    const boundsDefault = computeEventBounds({
      id: "1",
      title: "Manif",
      location: "",
      time: "",
      finished: false,
    });
    // start 7.5: (7.5 - 6) / 18 * 100 = 8.33%
    expect(boundsDefault.topPercent).toBeCloseTo(8.33, 1);
    // duration 10.5h: 10.5 / 18 * 100 = 58.33%
    expect(boundsDefault.heightPercent).toBeCloseTo(58.33, 1);

    // Only start defined: default end is 18h
    const boundsStartOnly = computeEventBounds({
      id: "2",
      title: "Rassemblement",
      location: "",
      time: "",
      finished: false,
      startHour: 10,
    });
    // start 10: (10 - 6) / 18 * 100 = 22.22%
    expect(boundsStartOnly.topPercent).toBeCloseTo(22.22, 1);
    // duration 8h (10 to 18): 8 / 18 * 100 = 44.44%
    expect(boundsStartOnly.heightPercent).toBeCloseTo(44.44, 1);
  });

  describe("day timeline", () => {
    const at = (id: string, startTime: string, startHour: number): DayEvent => ({
      id,
      title: `Événement ${id}`,
      location: "",
      time: `${startTime} – 18:00`,
      finished: false,
      startHour,
      endHour: 18,
      startTime,
    });
    const day = (events: DayEvent[]) =>
      renderMonth({ initialView: "day", eventsByDay: { "2026-10-07": events } });

    it("shows the whole day: an event of the early morning is on the timeline, not clamped to 6h", () => {
      const range = { min: 0, max: 24 };
      const early = { ...at("a", "03:00", 3), endHour: 4 };
      // 3h is an eighth of the way down 00:00-24:00 (it would sit on the very first row of a 6h-24h timeline).
      expect(computeEventBounds(early, range).topPercent).toBeCloseTo(12.5, 1);
      expect(computeEventBounds(early, range).heightPercent).toBeCloseTo(8, 1);
      expect(computeEventBounds(early).topPercent).toBe(0);
    });

    it("keeps the week columns on 6h-24h", () => {
      // 10h in 6h-24h: 4 / 18, as before the day view got its own range.
      expect(computeEventBounds(at("a", "10:00", 10)).topPercent).toBeCloseTo(22.22, 1);
    });

    it("gives one marker per exact start time, from the top of the timeline down", () => {
      const markers = startMarkersOf([
        at("a", "14:30", 14.5),
        at("b", "09:15", 9.25),
        at("c", "14:30", 14.5),
      ]);
      expect(markers.map((marker) => marker.startTime)).toEqual(["09:15", "14:30"]);
      // 9h15 is 9.25 / 24 of the way down the 00:00-24:00 timeline.
      expect(markers[0]!.topPercent).toBeCloseTo(38.54, 1);
      expect(markers[1]!.topPercent).toBeCloseTo(60.42, 1);
      expect(markers[0]!.hour).toBe(9.25);
    });

    it("has none for an event without an exact start time", () => {
      expect(startMarkersOf([exam])).toEqual([]);
    });

    it("prints the exact start in the left strip, with the other hours, like the iOS Calendar", () => {
      const { container } = day([at("a", "09:30", 9.5)]);
      const marker = container.querySelector('[data-start-marker="09:30"]')!;
      expect(marker).not.toBeNull();
      // A decoration: the time is already in the name of the event link.
      expect(marker).toHaveAttribute("aria-hidden", "true");
      // The time comes first (left), then the dot, then the line: nothing is written on the right.
      const [label, dot, line] = Array.from(marker.children);
      expect(label).toHaveTextContent("09:30");
      expect(dot).toHaveClass("rounded-full");
      expect(line).toHaveTextContent("");
      expect(marker.lastElementChild).toBe(line);
      expect(label).toHaveClass("text-accent", "w-11", "text-right");
      expect(
        screen.getAllByRole("link", { name: /09:30 – 18:00 Événement a/ }).length,
      ).toBeGreaterThan(0);
    });

    it("hides the hour label that a start marker would overlap, and only that one", () => {
      day([at("a", "12:10", 12 + 10 / 60)]);
      expect(screen.getByText("12:00")).toHaveClass("opacity-0");
      expect(screen.getByText("06:00")).not.toHaveClass("opacity-0");
      expect(screen.getByText("18:00")).not.toHaveClass("opacity-0");
    });

    it("is only in the day view", () => {
      const { container } = renderMonth({
        initialView: "week",
        eventsByDay: { "2026-10-07": [at("a", "09:30", 9.5)] },
      });
      expect(container.querySelector("[data-start-marker]")).toBeNull();
    });
  });

  it("switches views via pinch gesture (zoom in / zoom out with two fingers)", () => {
    renderMonth({ initialView: "month" });
    const container = screen.getByRole("grid", { name: /^Calendrier/ }).parentElement
      ?.parentElement;
    expect(container).toBeInTheDocument();

    // Pinch out (spread fingers): month -> week
    fireEvent.touchStart(container!, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 120, clientY: 100 },
      ],
    });
    fireEvent.touchMove(container!, {
      touches: [
        { clientX: 80, clientY: 100 },
        { clientX: 160, clientY: 100 },
      ],
    });
    fireEvent.touchEnd(container!);
    expect(screen.getByRole("heading", { level: 2, name: /Semaine/ })).toBeInTheDocument();

    // Pinch out again: week -> day
    fireEvent.touchStart(container!, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 120, clientY: 100 },
      ],
    });
    fireEvent.touchMove(container!, {
      touches: [
        { clientX: 80, clientY: 100 },
        { clientX: 160, clientY: 100 },
      ],
    });
    fireEvent.touchEnd(container!);
    expect(
      screen.getByRole("heading", { level: 2, name: /mercredi 7 octobre 2026/ }),
    ).toBeInTheDocument();

    // Pinch in (pinch fingers together): day -> week
    fireEvent.touchStart(container!, {
      touches: [
        { clientX: 50, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });
    fireEvent.touchMove(container!, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 120, clientY: 100 },
      ],
    });
    fireEvent.touchEnd(container!);
    expect(screen.getByRole("heading", { level: 2, name: /Semaine/ })).toBeInTheDocument();
  });
});
