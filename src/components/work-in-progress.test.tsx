import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkInProgress } from "./work-in-progress";

describe("WorkInProgress", () => {
  it("announces that the page is under development and lists what is coming", () => {
    render(
      <WorkInProgress
        title="La carte arrive bientôt"
        description="Description."
        icon={<svg data-testid="icon" />}
        upcoming={["Tracé", "Position"]}
      />,
    );
    const region = screen.getByRole("region", {
      name: "La carte arrive bientôt : en développement",
    });
    expect(within(region).getByRole("status")).toHaveTextContent("En développement");
    expect(within(region).getByRole("heading", { name: "La carte arrive bientôt" })).toBeVisible();
    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    expect(within(region).getAllByText("Bientôt")).toHaveLength(2);
  });
});
