import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("renders an allowed Discord picture with an accessible name", () => {
    render(<Avatar pseudo="Alice" url="https://cdn.discordapp.com/avatars/1/a.png" />);
    expect(screen.getByRole("img", { name: "Photo de profil de Alice" })).toHaveAttribute(
      "src",
      "https://cdn.discordapp.com/avatars/1/a.png",
    );
  });

  it("falls back to initials for a missing or untrusted URL", () => {
    const { rerender } = render(<Avatar pseudo="la._.yandere" url={null} />);
    expect(screen.getByText("LY")).toBeInTheDocument();
    rerender(<Avatar pseudo="Bob Martin" url="https://evil.example/a.png" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("BM")).toBeInTheDocument();
  });

  it("has the rounded-square shape of the controls, and can fill its parent", () => {
    const { container } = render(
      <Avatar pseudo="Alice" url="https://cdn.discordapp.com/avatars/1/a.png" size="fill" />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveClass("rounded-control", "h-full", "w-full");
    expect(img).not.toHaveClass("rounded-full");
    expect(img?.className).not.toMatch(/\bh-(9|11|20|24)\b/);
  });

  it("can be decorative", () => {
    const { container } = render(
      <Avatar pseudo="Alice" url="https://cdn.discordapp.com/avatars/1/a.png" decorative />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
