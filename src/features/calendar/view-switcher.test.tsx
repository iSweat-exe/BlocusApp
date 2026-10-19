import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ViewSwitcher } from "./view-switcher";

describe("ViewSwitcher", () => {
  it("renders trigger button with current view icon and accessible label", () => {
    render(<ViewSwitcher currentView="month" onChangeView={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /Changer de vue/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("opens micro dropdown showing all 3 options with the active one marked", async () => {
    const user = userEvent.setup();
    render(<ViewSwitcher currentView="month" onChangeView={vi.fn()} />);

    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Changer de vue/ }));
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Mois");
    expect(items[0]).toHaveAttribute("aria-current", "true");
    expect(items[1]).toHaveTextContent("Semaine");
    expect(items[2]).toHaveTextContent("Jour");
  });

  it("calls onChangeView with selected option and closes menu", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ViewSwitcher currentView="month" onChangeView={handleChange} />);

    await user.click(screen.getByRole("button", { name: /Changer de vue/ }));
    await user.click(screen.getByRole("menuitem", { name: "Semaine" }));

    expect(handleChange).toHaveBeenCalledWith("week");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes when pressing Escape", async () => {
    const user = userEvent.setup();
    render(<ViewSwitcher currentView="week" onChangeView={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Changer de vue/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
