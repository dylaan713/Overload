// @vitest-environment jsdom
// Real animations (skipAnimations off): these tests grab things mid-flight, which the instant
// animations in the rest of the suite can't exercise (wave 2 review, I9).
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { Sheet } from "../../src/ui/Sheet";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const progress = () => document.documentElement.style.getPropertyValue("--sheet-progress");
const handle = () => screen.getByTestId("sheet-handle");

describe("sheet interruptions (real animations)", () => {
  it("Escape during a drag doesn't leave the sheet unclosable", async () => {
    const onClose = vi.fn();
    render(<Sheet title="S" onClose={onClose}>body</Sheet>);
    await wait(700);
    fireEvent.pointerDown(handle(), { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientY: 130 });
    await wait(30);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await wait(40);
    fireEvent.pointerMove(handle(), { pointerId: 1, clientY: 110 });
    await wait(150);
    fireEvent.pointerUp(handle(), { pointerId: 1, clientY: 110 });
    await wait(700);
    expect(onClose).not.toHaveBeenCalled(); // released near the top: it stays open…
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await wait(700);
    expect(onClose).toHaveBeenCalledTimes(1); // …and Done still works
  });

  it("the finger keeps control while a close was requested mid-drag", async () => {
    render(<Sheet title="S" onClose={() => {}}>body</Sheet>);
    await wait(700);
    fireEvent.pointerDown(handle(), { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientY: 140 });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await wait(100);
    fireEvent.pointerMove(handle(), { pointerId: 1, clientY: 101 });
    await wait(20);
    expect(screen.getByRole("dialog").style.transform).toMatch(/translateY\(1px\)|none/);
  });

  it("a second finger can't strand the sheet mid-drag", async () => {
    const onClose = vi.fn();
    render(<Sheet title="S" onClose={onClose}>body</Sheet>);
    await wait(700);
    fireEvent.pointerDown(handle(), { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientY: 150 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientY: 250 });
    fireEvent.pointerDown(handle(), { pointerId: 2, clientY: 50 });
    fireEvent.pointerUp(handle(), { pointerId: 2, clientY: 50 });
    await wait(150);
    fireEvent.pointerUp(handle(), { pointerId: 1, clientY: 250 });
    await wait(800);
    expect(onClose).not.toHaveBeenCalled();
    expect(progress()).toBe("0"); // sprang back fully open, page behind restored
  });
});
