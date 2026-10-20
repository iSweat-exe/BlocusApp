import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCalendarShortcuts } from "./use-calendar-shortcuts";

function Harness({ onView, onNav }: { onView: (v: string) => void; onNav: (n: string) => void }) {
  useCalendarShortcuts(onView);
  return (
    <div>
      {(["prev", "next", "today"] as const).map((nav) => (
        <a key={nav} href="#" data-calendar-nav={nav} onClick={() => onNav(nav)}>
          {nav}
        </a>
      ))}
      <input aria-label="field" />
    </div>
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useCalendarShortcuts", () => {
  it("opens a view with M, S and J (either case)", () => {
    const onView = vi.fn();
    render(<Harness onView={onView} onNav={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: "s" });
    fireEvent.keyDown(document.body, { key: "J" });
    fireEvent.keyDown(document.body, { key: "m" });
    expect(onView.mock.calls.map(([v]) => v)).toEqual(["week", "day", "month"]);
  });

  it("presses the navigation links with the arrows and T", () => {
    const onNav = vi.fn();
    render(<Harness onView={vi.fn()} onNav={onNav} />);
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "t" });
    expect(onNav.mock.calls.map(([n]) => n)).toEqual(["prev", "next", "today"]);
  });

  it("stays out of the way of modifiers, fields and dialogs", () => {
    const onView = vi.fn();
    const { getByLabelText } = render(<Harness onView={onView} onNav={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "s", metaKey: true });
    fireEvent.keyDown(getByLabelText("field"), { key: "s" });
    expect(onView).not.toHaveBeenCalled();

    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    fireEvent.keyDown(document.body, { key: "s" });
    expect(onView).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", () => {
    const onView = vi.fn();
    const { unmount } = render(<Harness onView={onView} onNav={vi.fn()} />);
    unmount();
    fireEvent.keyDown(document.body, { key: "s" });
    expect(onView).not.toHaveBeenCalled();
  });
});
