import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthView, type DayEvent } from "./month-view";

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

    // The whole day, from midnight to midnight, one hour per line.
    expect(screen.getByRole("region", { name: /sur 24 heures/ })).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText("23:00")).toBeInTheDocument();

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
