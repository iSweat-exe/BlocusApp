import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarPage, { CalendarContent } from "./page";

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/calendar/calendar-view", () => ({
  CalendarView: ({
    initialView,
    month,
    day,
  }: {
    initialView?: string;
    month: string;
    day: string;
  }) => (
    <div data-testid="calendar-view" data-view={initialView} data-month={month} data-day={day}>
      CalendarView
    </div>
  ),
}));

describe("CalendarPage", () => {
  it("renders page container with fallback skeleton initially", () => {
    render(<CalendarPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    expect(screen.getByRole("heading", { level: 1, name: "Calendrier" })).toBeInTheDocument();
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });
});

describe("CalendarContent", () => {
  it("parses view, week, and day search params and forwards them to CalendarView", async () => {
    const content = await CalendarContent({
      searchParams: Promise.resolve({
        view: "week",
        week: "2026-42",
        day: "2026-10-15",
      }),
    });
    render(content);

    const view = screen.getByTestId("calendar-view");
    expect(view).toHaveAttribute("data-view", "week");
    expect(view).toHaveAttribute("data-day", "2026-10-15");
    expect(view).toHaveAttribute("data-month", "2026-10");
  });

  it("handles day-only search params and defaults to day view", async () => {
    const content = await CalendarContent({
      searchParams: Promise.resolve({
        day: "2026-10-20",
      }),
    });
    render(content);

    const view = screen.getByTestId("calendar-view");
    expect(view).toHaveAttribute("data-view", "day");
    expect(view).toHaveAttribute("data-day", "2026-10-20");
    expect(view).toHaveAttribute("data-month", "2026-10");
  });
});
