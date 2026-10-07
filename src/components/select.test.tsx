import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("Select", () => {
  it("shows the default value and submits it through a hidden input", () => {
    const { container } = render(
      <form>
        <Select label="Lettre" name="letter" options={OPTIONS} defaultValue="b" />
      </form>,
    );
    expect(screen.getByRole("button", { name: "Lettre" })).toHaveTextContent("Beta");
    expect(container.querySelector<HTMLInputElement>('input[name="letter"]')?.value).toBe("b");
  });

  it("opens a listbox and selects an option with the pointer", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Select label="Lettre" name="letter" options={OPTIONS} onChange={onChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Lettre" }));
    await user.click(screen.getByRole("option", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Lettre" })).toHaveTextContent("Gamma");
    expect(container.querySelector<HTMLInputElement>('input[name="letter"]')?.value).toBe("c");
  });

  it("supports the keyboard: arrows, Enter and Escape", async () => {
    const user = userEvent.setup();
    render(<Select label="Lettre" options={OPTIONS} />);
    const trigger = screen.getByRole("button", { name: "Lettre" });
    await user.click(trigger);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(trigger).toHaveTextContent("Beta");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveTextContent("Beta");
  });

  it("marks the current option as selected", async () => {
    const user = userEvent.setup();
    render(<Select label="Lettre" options={OPTIONS} value="c" />);
    await user.click(screen.getByRole("button", { name: "Lettre" }));
    expect(screen.getByRole("option", { name: "Gamma" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("aria-selected", "false");
  });

  it("stays closed when disabled", () => {
    render(<Select label="Lettre" options={OPTIONS} disabled />);
    const trigger = screen.getByRole("button", { name: "Lettre" });
    fireEvent.click(trigger);
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
