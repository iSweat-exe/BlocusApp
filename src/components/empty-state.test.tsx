import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("shows the title and the help text, with a decorative icon", () => {
    const { container } = render(
      <EmptyState icon={<svg data-testid="icon" />} title="Rien pour l'instant">
        Reviens vite.
      </EmptyState>,
    );
    expect(screen.getByText("Rien pour l'instant")).toBeInTheDocument();
    expect(screen.getByText("Reviens vite.")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"] [data-testid="icon"]')).not.toBeNull();
  });

  it("works without a help text", () => {
    render(<EmptyState icon={<svg />} title="Vide" />);
    expect(screen.getByText("Vide")).toBeInTheDocument();
  });

  it("has a compact form for a spot inside a list", () => {
    const { container } = render(<EmptyState compact icon={<svg />} title="Vide" />);
    expect(container.firstElementChild?.className).toContain("flex items-center");
    expect(container.firstElementChild?.className).not.toContain("py-10");
  });
});
