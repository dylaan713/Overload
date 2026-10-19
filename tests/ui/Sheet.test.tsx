// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "../../src/ui/Sheet";
import { NumberField } from "../../src/ui/NumberField";

const progress = () => document.documentElement.style.getPropertyValue("--sheet-progress");

describe("Sheet", () => {
  it("is a labelled dialog that takes focus; modality comes from the caller's inert page, not aria-modal", () => {
    render(<Sheet title="Settings" onClose={() => {}}>body</Sheet>);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveFocus();
  });

  it("closes on Done", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Settings" onClose={onClose}>body</Sheet>);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Settings" onClose={onClose}>body</Sheet>);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("Done pressed twice calls onClose once", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Settings" onClose={onClose}>body</Sheet>);
    const done = screen.getByRole("button", { name: "Done" });
    fireEvent.click(done);
    fireEvent.click(done);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a Back button only when onBack is given", async () => {
    const onBack = vi.fn();
    const { rerender } = render(<Sheet title="Exercises" onClose={() => {}}>x</Sheet>);
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    rerender(<Sheet title="Exercises" onClose={() => {}} onBack={onBack} backLabel="Settings">x</Sheet>);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders headerAction in the header", () => {
    render(<Sheet title="Library" onClose={() => {}} headerAction={<button type="button">Add exercise</button>}>x</Sheet>);
    expect(screen.getByRole("button", { name: "Add exercise" })).toBeInTheDocument();
  });

  it("returns focus to the opener when it unmounts", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<Sheet title="Settings" onClose={() => {}}>x</Sheet>);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("sets --sheet-progress while open and removes it on unmount", () => {
    const { unmount } = render(<Sheet title="Settings" onClose={() => {}}>x</Sheet>);
    expect(progress()).not.toBe("");
    unmount();
    expect(progress()).toBe("");
  });

  it("a value typed in a field commits when Done is pressed", async () => {
    const onChange = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Sheet title="Settings" onClose={() => setOpen(false)}>
          <NumberField label="Rest" value={90} onChange={onChange} />
        </Sheet>
      ) : null;
    }
    render(<Host />);
    const input = screen.getByLabelText("Rest");
    await userEvent.clear(input);
    await userEvent.type(input, "120");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it("dragging the grabber down past half closes; a short drag springs back", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Settings" onClose={onClose}>x</Sheet>);
    const grabber = screen.getByTestId("sheet-handle");
    await waitFor(() => expect(progress()).toBe("0")); // fully open before grabbing
    // jsdom has no layout (the sheet uses window.innerHeight, 768, as its height) and fires events ~1ms
    // apart, which would read as a flick. Space the events 400ms apart so these are slow drags.
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (t += 400));
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 140 });
    fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 140 });
    await new Promise((r) => setTimeout(r, 30));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(grabber, { pointerId: 2, clientY: 100 });
    fireEvent.pointerMove(grabber, { pointerId: 2, clientY: 600 });
    fireEvent.pointerUp(grabber, { pointerId: 2, clientY: 600 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    vi.restoreAllMocks();
  });

  it("grabbing a closing sheet cancels the close; a later Done closes exactly once", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Settings" onClose={onClose}>x</Sheet>);
    await waitFor(() => expect(progress()).toBe("0"));
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (t += 400));
    const grabber = screen.getByTestId("sheet-handle");
    fireEvent.click(screen.getByRole("button", { name: "Done" })); // close starts…
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 300 }); // …and is grabbed in the same frame
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 280 });
    fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 280 });
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  describe("pulling the content down (like iOS)", () => {
    // Slow drags: events 400ms apart (see the grabber test).
    const slow = () => {
      let t = 0;
      vi.spyOn(performance, "now").mockImplementation(() => (t += 400));
    };
    const pull = (el: Element, from: { x: number; y: number }, to: { x: number; y: number }) => {
      fireEvent.touchStart(el, { touches: [{ clientX: from.x, clientY: from.y }] });
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      fireEvent.touchMove(el, { touches: [{ clientX: mid.x, clientY: mid.y }] });
      fireEvent.touchMove(el, { touches: [{ clientX: to.x, clientY: to.y }] });
      fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: to.x, clientY: to.y }] });
    };

    it("closes from content at the top; a short pull springs back", async () => {
      const onClose = vi.fn();
      render(<Sheet title="Settings" onClose={onClose}><p>content</p></Sheet>);
      await waitFor(() => expect(progress()).toBe("0"));
      slow();
      pull(screen.getByText("content"), { x: 100, y: 100 }, { x: 100, y: 140 });
      await new Promise((r) => setTimeout(r, 30));
      expect(onClose).not.toHaveBeenCalled();
      pull(screen.getByText("content"), { x: 100, y: 100 }, { x: 100, y: 600 });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      vi.restoreAllMocks();
    });

    it("leaves scrolled content, upward pulls and sideways swipes alone", async () => {
      const onClose = vi.fn();
      render(
        <Sheet title="Settings" onClose={onClose}>
          <div data-testid="scroller" style={{ overflowY: "auto" }}><p>content</p></div>
        </Sheet>,
      );
      await waitFor(() => expect(progress()).toBe("0"));
      slow();
      const scroller = screen.getByTestId("scroller");
      pull(scroller, { x: 100, y: 600 }, { x: 100, y: 100 }); // scrolling down the content
      pull(scroller, { x: 20, y: 100 }, { x: 600, y: 160 }); // swipe back
      Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
      Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 600 });
      scroller.scrollTop = 300;
      pull(screen.getByText("content"), { x: 100, y: 100 }, { x: 100, y: 600 }); // scrolling back up
      await new Promise((r) => setTimeout(r, 50));
      expect(onClose).not.toHaveBeenCalled();
      expect(progress()).toBe("0");
      vi.restoreAllMocks();
    });
  });
});

