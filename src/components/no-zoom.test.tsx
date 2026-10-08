import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoZoom } from "./no-zoom";

const fire = (type: string) => {
  const event = new Event(type, { cancelable: true, bubbles: true });
  document.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("NoZoom", () => {
  it("cancels the iOS pinch-zoom gesture events", () => {
    render(<NoZoom />);
    expect(fire("gesturestart")).toBe(true);
    expect(fire("gesturechange")).toBe(true);
  });

  it("leaves other events alone, and stops cancelling once removed", () => {
    const { unmount } = render(<NoZoom />);
    expect(fire("touchmove")).toBe(false);
    unmount();
    expect(fire("gesturestart")).toBe(false);
  });
});
