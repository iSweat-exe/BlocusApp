import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import { ThemePicker } from "./theme-picker";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemePicker", () => {
  it("follows the system by default", () => {
    render(<ThemePicker />);
    expect(screen.getByRole("radio", { name: "Système" })).toBeChecked();
  });

  it("forces dark, then light, then goes back to the system", async () => {
    const user = userEvent.setup();
    const root = document.documentElement;
    render(<ThemePicker />);

    await user.click(screen.getByRole("radio", { name: "Sombre" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Sombre" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Clair" }));
    expect(root.getAttribute("data-theme")).toBe("light");

    await user.click(screen.getByRole("radio", { name: "Système" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("restores the system browser bar colors", async () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">';
    const user = userEvent.setup();
    render(<ThemePicker />);
    const meta = document.querySelector<HTMLMetaElement>("meta[name=theme-color]")!;
    await user.click(screen.getByRole("radio", { name: "Sombre" }));
    expect(meta.getAttribute("content")).toBe("#0a0a0a");
    expect(meta.hasAttribute("media")).toBe(false);
    await user.click(screen.getByRole("radio", { name: "Système" }));
    expect(meta.getAttribute("content")).toBe("#ffffff");
    expect(meta.getAttribute("media")).toBe("(prefers-color-scheme: light)");
    document.head.innerHTML = "";
  });
});
