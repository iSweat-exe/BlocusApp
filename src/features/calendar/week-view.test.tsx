import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DayEvent } from "./calendar-types";
import { WeekView } from "./week-view";

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
  endHour?: number,
  extra: Partial<DayEvent> = {},
): DayEvent => ({
  id,
  title: `Événement ${id}`,
  location: "",
  time: "",
  finished: false,
  startHour,
  ...(endHour === undefined ? {} : { endHour }),
  startTime: `${String(startHour).padStart(2, "0")}:00`,
  ...extra,
});

// Monday 19 to Sunday 25 October 2026.
const renderWeek = (eventsByDay: Record<string, DayEvent[]>, onSelect = vi.fn()) =>
  render(
    <WeekView day="2026-10-21" today="2026-10-21" eventsByDay={eventsByDay} onSelect={onSelect} />,
  );

describe("WeekView", () => {
  it("has seven day columns, today and the selected day marked", () => {
    renderWeek({});
    expect(screen.getAllByRole("gridcell")).toHaveLength(7);
    expect(screen.getByRole("gridcell", { name: /mercredi 21 octobre 2026/ })).toHaveAttribute(
      "aria-current",
      "date",
    );
  });

  it("draws an event with its text, in its own colour, with a bar on the left", () => {
    renderWeek({ "2026-10-21": [event("a", 10, 13)] });
    const block = screen.getByRole("link", { name: /Événement a/ });
    expect(block).toHaveTextContent("Événement a");
    expect(block).toHaveTextContent("10:00");
    expect(block.style.borderLeft).toContain("oklch");
    expect(block).toHaveAttribute("data-columns", "1");
  });

  it("puts overlapping events side by side in their column, as slivers without text", () => {
    renderWeek({ "2026-10-21": [event("a", 10, 12), event("b", 11, 13)] });
    const a = screen.getByRole("link", { name: /Événement a/ });
    const b = screen.getByRole("link", { name: /Événement b/ });
    expect(a).toHaveAttribute("data-column", "0");
    expect(a).toHaveAttribute("data-columns", "2");
    expect(b).toHaveAttribute("data-column", "1");
    expect(b).toHaveAttribute("data-columns", "2");
    // No room for text in half of a narrow column: the name stays in the tooltip and the accessible name.
    expect(a).not.toHaveTextContent("Événement a");
    expect(a).toHaveAttribute("title", expect.stringContaining("Événement a"));
    expect(a.style.borderLeft).not.toBe(b.style.borderLeft);
  });

  it("lays out each day on its own: events of two days never share a column", () => {
    renderWeek({
      "2026-10-20": [event("a", 10, 12)],
      "2026-10-21": [event("b", 10, 12)],
    });
    expect(screen.getByRole("link", { name: /Événement a/ })).toHaveAttribute("data-columns", "1");
    expect(screen.getByRole("link", { name: /Événement b/ })).toHaveAttribute("data-columns", "1");
  });

  it("draws an event without an end as a block of one hour, not up to 18h", () => {
    renderWeek({ "2026-10-21": [event("a", 10)] });
    const block = screen.getByRole("link", { name: /Événement a/ });
    // One hour of 18 is 5.6 %, which the minimum height of the week (8 %) rounds up.
    expect(block.style.height).toContain("calc(8% - 1px)");
  });

  it("greys a finished event and strikes its title", () => {
    renderWeek({ "2026-10-21": [event("a", 10, 12, { finished: true })] });
    const block = screen.getByRole("link", { name: /Événement a/ });
    expect(block.style.borderLeft).not.toContain("oklch");
    expect(within(block).getByText("Événement a")).toHaveClass("line-through");
  });

  it("selects a day when its column is tapped, and not when an event of it is", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWeek({ "2026-10-22": [event("a", 10, 12)] }, onSelect);

    await user.click(screen.getByRole("gridcell", { name: /jeudi 22 octobre 2026/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-10-22");

    onSelect.mockClear();
    await user.click(screen.getByRole("link", { name: /Événement a/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
