// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
