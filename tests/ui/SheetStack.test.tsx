// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { SheetStack, type SheetView } from "../../src/ui/SheetStack";

const leaf = (n: number): SheetView => ({
  id: `v${n}`,
  title: `View ${n}`,
  render: (nav) => (
    <div>
      <p>Body {n}</p>
      <button type="button" onClick={() => nav.push(leaf(n + 1))}>Open {n + 1}</button>
      <button type="button" onClick={() => nav.popToRoot()}>Root from {n}</button>
    </div>
  ),
});
const root: SheetView = { ...leaf(1), id: "root", title: "Settings" };

describe("SheetStack", () => {
  it("shows the root title with no Back", () => {
    render(<SheetStack root={root} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("push shows the new view with Back labelled with the parent's title; Back pops", async () => {
    render(<SheetStack root={root} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Open 2" }));
    expect(screen.getByRole("dialog", { name: "View 2" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument());
  });

  it("popToRoot from depth 3 returns to the root", async () => {
    render(<SheetStack root={root} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Open 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Open 3" }));
    expect(screen.getByRole("dialog", { name: "View 3" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Root from 3" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument());
  });

  it("only the top view is interactive", async () => {
    render(<SheetStack root={root} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Open 2" }));
    expect(screen.queryByRole("button", { name: "Open 2" })).toBeNull(); // the parent is inert / hidden from AT
    expect(screen.getByRole("button", { name: "Open 3" })).toBeInTheDocument();
  });

  it("Escape closes the whole stack at any depth", async () => {
    const onClose = vi.fn();
    render(<SheetStack root={root} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Open 2" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe("SheetStack focus (wave 2 review)", () => {
  it("a push moves focus into the new view; Back returns it to the opener", async () => {
    render(<SheetStack root={root} onClose={() => {}} />);
    const opener = screen.getByRole("button", { name: "Open 2" });
    await userEvent.click(opener);
    expect(screen.getByText("Body 2").closest("section")).toContainElement(document.activeElement as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open 2" })).toHaveFocus());
  });
});

describe("reduced motion (wave 2 review)", () => {
  it("drags still follow the finger", async () => {
    render(
      <MotionConfig reducedMotion="always">
        <SheetStack root={root} onClose={() => {}} />
      </MotionConfig>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open 2" }));
    const top = () => screen.getByText("Body 2").closest("section")!;
    await waitFor(() => expect(top().style.transform).toMatch(/^(none|translateX\(0px\))?$/)); // settled
    const stack = top().parentElement!;
    fireEvent.pointerDown(stack, { pointerId: 1, clientX: 5, clientY: 300 });
    fireEvent.pointerMove(stack, { pointerId: 1, clientX: 120, clientY: 300 });
    // Motion renders style changes on the next frame.
    await waitFor(() => expect(top().style.transform).toContain("translateX(115px)"));
    fireEvent.pointerUp(stack, { pointerId: 1, clientX: 120, clientY: 300 });
    const handle = screen.getByTestId("sheet-handle");
    fireEvent.pointerDown(handle, { pointerId: 2, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 160 });
    await waitFor(() => expect(screen.getByRole("dialog").style.transform).toContain("translateY(60px)"));
  });
});

describe("popTo", () => {
  it("pops back to a named view, keeping the views below it", async () => {
    const back: SheetView = {
      id: "v3",
      title: "View 3",
      render: (nav) => <button type="button" onClick={() => nav.popTo("v2")}>Back to 2</button>,
    };
    const two: SheetView = { id: "v2", title: "View 2", render: (nav) => <button type="button" onClick={() => nav.push(back)}>Open 3</button> };
    const r: SheetView = { id: "root", title: "Settings", render: (nav) => <button type="button" onClick={() => nav.push(two)}>Open 2</button> };
    render(<SheetStack root={r} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Open 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Open 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Back to 2" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "View 2" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument(); // Back still leads to the root
  });
});

