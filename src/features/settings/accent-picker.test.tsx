import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ACCENT_STORAGE_KEY } from "./accent";
import { AccentPicker } from "./accent-picker";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("style");
});

describe("AccentPicker", () => {
  it("selects the default red when nothing is saved", () => {
    render(<AccentPicker />);
    expect(screen.getByRole("radio", { name: "Rouge" })).toBeChecked();
    expect(screen.queryByRole("button", { name: /Rétablir/ })).toBeNull();
  });

  it("saves and applies a preset, then restores the default", async () => {
    const user = userEvent.setup();
    render(<AccentPicker />);
    await user.click(screen.getByRole("radio", { name: "Bleu" }));
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe("#3b82f6");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#3b82f6");
    expect(screen.getByRole("radio", { name: "Bleu" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /Rétablir/ }));
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(screen.getByRole("radio", { name: "Rouge" })).toBeChecked();
  });

  it("applies a typed color once it is valid and flags an invalid one", async () => {
    const user = userEvent.setup();
    render(<AccentPicker />);
    const field = screen.getByLabelText("Couleur personnalisée", { selector: "input[type=text]" });
    await user.clear(field);
    await user.type(field, "#12");
    expect(screen.getByText(/Format attendu/)).toBeInTheDocument();
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBeNull();
    await user.type(field, "3456");
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe("#123456");
    expect(screen.queryByText(/Format attendu/)).toBeNull();
  });
});
