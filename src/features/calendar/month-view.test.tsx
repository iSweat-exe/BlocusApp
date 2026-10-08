import { render, screen, within } from "@testing-library/react";
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
  it("shows the events of the initial day", () => {
    renderMonth();
    expect(screen.getByRole("heading", { name: "mercredi 7 octobre 2026" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Révision maths/ });
    expect(link).toHaveAttribute("href", "/calendar/e1");
    // A list of links must not prefetch one page per row.
    expect(link).toHaveAttribute("data-prefetch", "false");
  });

  it("switches day on the client and keeps the URL shareable, without navigating", async () => {
    const user = userEvent.setup();
    renderMonth();
    const grid = screen.getByRole("grid");
    await user.click(within(grid).getByRole("gridcell", { name: /^jeudi 8 octobre 2026/ }));
    expect(screen.getByRole("heading", { name: "jeudi 8 octobre 2026" })).toBeInTheDocument();
    expect(screen.getByText("Aucun événement ce jour-là.")).toBeInTheDocument();
    expect(window.location.search).toBe("?month=2026-10&day=2026-10-08");

    await user.click(within(grid).getByRole("gridcell", { name: /^mercredi 7 octobre 2026/ }));
    expect(screen.getByRole("link", { name: /Révision maths/ })).toBeInTheDocument();
  });

  it("counts events in the cell labels and marks the selected day", () => {
    renderMonth();
    const cell = screen.getByRole("gridcell", { name: "mercredi 7 octobre 2026, 1 événement" });
    expect(cell).toHaveAttribute("aria-selected", "true");
    expect(cell).toHaveAttribute("aria-current", "date");
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
});
