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

  it("can be decorative", () => {
    const { container } = render(
      <Avatar pseudo="Alice" url="https://cdn.discordapp.com/avatars/1/a.png" decorative />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
