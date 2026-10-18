// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import type { StoreDoc } from "../../src/domain/types";
import { day, doc, ex, sets, warm } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { failing, stored } from "../helpers/seed";

const TODAY = "2026-10-18";
const row = ex("row", { name: "Seated cable row", equipment: "cable", primary: ["upper-back"] });
const open = (d: StoreDoc) =>
  renderWithStore(<Shell />, { kv: createMemoryKV({ [V2_KEY]: JSON.stringify(d) }), today: TODAY, now: () => Date.parse("2026-10-18T12:00:00") });
const setRows = () => within(screen.getByRole("list", { name: "Sets today" })).getAllByRole("listitem");

afterEach(() => vi.restoreAllMocks());

describe("fixing a set", () => {
  it("tap loads it for editing; Save stores the change", async () => {
    const { user, kv } = await open(doc({ exercises: [row], sessions: [day(TODAY, [["row", [warm(70, 8), ...sets(130, [10, 10], [2, 1])]]])] }));
    await user.click(screen.getByRole("button", { name: /130 × 10.*Hard/ }));
    expect(screen.getByText("Editing set 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Reps")).toHaveValue("10");
    expect(screen.getByRole("radio", { name: "Hard" })).toHaveAttribute("aria-checked", "true");
    await user.clear(screen.getByLabelText("Reps"));
    await user.type(screen.getByLabelText("Reps"), "9");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(stored(kv).sessions[0]!.blocks[0]!.sets[2]).toEqual({ weight: 130, reps: 9, warmup: false, rir: 1 }));
    expect(screen.queryByText("Editing set 2")).toBeNull();
    expect(screen.getByRole("button", { name: "Log set" })).toBeInTheDocument();
  });

  it("changing the weight drops the unit-switch original", async () => {
    const d = doc({ exercises: [row], sessions: [day(TODAY, [["row", [{ weight: 59, reps: 10, warmup: false, rir: 2, orig: { weight: 130, unit: "lb" } }]]])] });
    d.settings.unit = "kg";
    const { user, kv } = await open(d);
    await user.click(screen.getByRole("button", { name: /59 × 10/ }));
    await user.clear(screen.getByLabelText("kg"));
    await user.type(screen.getByLabelText("kg"), "60");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(stored(kv).sessions[0]!.blocks[0]!.sets[0]).toEqual({ weight: 60, reps: 10, warmup: false, rir: 2 }));
  });

  it("Cancel changes nothing", async () => {
    const d = doc({ exercises: [row], sessions: [day(TODAY, [["row", sets(130, [10], [2])]])] });
    const { user, kv, uiStore } = await open(d);
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.type(screen.getByLabelText("Reps"), "5");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(kv.dump()[V2_KEY]).toBe(before);
    expect(uiStore.getState().log.draft).toMatchObject({ editing: null, reps: null });
    expect(screen.getByLabelText("Reps")).not.toHaveValue("105");
  });
});

describe("removing a set", () => {
  it("Delete set removes the day's only set; Undo brings back exactly what was there (review focus 2)", async () => {
    const d = doc({ exercises: [row], sessions: [day("2026-10-10", [["row", sets(120, [10])]]), day(TODAY, [["row", sets(130, [10], [2])]])] });
    const { user, kv } = await open(d);
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.click(screen.getByRole("button", { name: "Delete set" }));
    await waitFor(() => expect(stored(kv).sessions.map((s) => s.date)).toEqual(["2026-10-10"]));
    expect(screen.getByRole("status")).toHaveTextContent("Removed set 1");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(kv.dump()[V2_KEY]).toBe(before));
  });

  it("a swipe past half removes with Undo; a short swipe springs back", async () => {
    const d = doc({ exercises: [row], sessions: [day(TODAY, [["row", sets(130, [10, 9], [2, 1])]])] });
    const { kv } = await open(d);
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => t);
    const swipe = (el: HTMLElement, dx: number) => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 300, clientY: 10 });
      for (let i = 1; i <= 5; i++) {
        t += 100;
        fireEvent.pointerMove(el, { pointerId: 1, clientX: 300 - (dx * i) / 5, clientY: 10 });
      }
      t += 100;
      fireEvent.pointerUp(el, { pointerId: 1, clientX: 300 - dx, clientY: 10 });
    };
    swipe(setRows()[1]!, 40);
    await new Promise((r) => setTimeout(r, 400));
    expect(stored(kv).sessions[0]!.blocks[0]!.sets).toHaveLength(2);
    swipe(setRows()[1]!, 260);
    await waitFor(() => expect(stored(kv).sessions[0]!.blocks[0]!.sets.map((s) => s.reps)).toEqual([10]));
    expect(screen.getByRole("status")).toHaveTextContent("Removed set 2");
  });
});

describe("wave 3 review", () => {
  const three = () => doc({ exercises: [row], sessions: [day(TODAY, [["row", sets(130, [10, 9, 8], [2, 2, 1])]])] });
  const repsStored = (kv: Parameters<typeof stored>[0]) => stored(kv).sessions[0]!.blocks[0]!.sets.map((s) => s.reps);
  let t = 0;
  const swipe = (el: HTMLElement, dx: number) => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 300, clientY: 10 });
    for (let i = 1; i <= 5; i++) {
      t += 100;
      fireEvent.pointerMove(el, { pointerId: 1, clientX: 300 - (dx * i) / 5, clientY: 10 });
    }
    t += 100;
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 300 - dx, clientY: 10 });
  };
  const slowClock = () => vi.spyOn(performance, "now").mockImplementation(() => t);

  it("Undo while fixing another set ends the edit, so no set is overwritten", async () => {
    const { user, kv } = await open(three());
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.click(screen.getByRole("button", { name: "Delete set" }));
    await waitFor(() => expect(repsStored(kv)).toEqual([9, 8]));
    await user.click(screen.getByRole("button", { name: /130 × 8/ }));
    expect(screen.getByText("Editing set 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(repsStored(kv)).toEqual([10, 9, 8]));
    expect(screen.queryByText(/^Editing/)).toBeNull();
    expect(screen.getByRole("button", { name: "Log set" })).toBeInTheDocument();
  });

  it("Undo after another set was logged in the meantime puts the set back in place", async () => {
    const { user, kv } = await open(three());
    await user.click(screen.getByRole("button", { name: /130 × 9/ }));
    await user.click(screen.getByRole("button", { name: "Delete set" }));
    await waitFor(() => expect(repsStored(kv)).toEqual([10, 8]));
    await user.type(screen.getByLabelText("Reps"), "7");
    await user.click(screen.getByRole("radio", { name: "All out" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(repsStored(kv)).toEqual([10, 8, 7]));
    // Logging a set shows no toast, so the removal's Undo is still offered.
    expect(screen.queryByRole("button", { name: "Undo" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(repsStored(kv)).toEqual([10, 9, 8, 7]));
  });

  it("two quick swipes remove exactly the two sets swiped", async () => {
    const { kv } = await open(three());
    slowClock();
    swipe(setRows()[0]!, 260);
    swipe(setRows()[1]!, 260);
    await waitFor(() => expect(repsStored(kv)).toEqual([8]));
  });

  it("a swipe that springs back doesn't swallow the next tap", async () => {
    const { user } = await open(three());
    slowClock();
    swipe(setRows()[1]!, 20);
    await new Promise((r) => setTimeout(r, 300));
    await user.click(screen.getByRole("button", { name: /130 × 9/ }));
    expect(screen.getByText("Editing set 2")).toBeInTheDocument();
  });

  it("fixing a set keeps the half-typed next set", async () => {
    const { user } = await open(three());
    await user.type(screen.getByLabelText("Reps"), "6");
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: /130 × 9/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Reps")).toHaveValue("6");
    expect(screen.getByRole("radio", { name: "Hard" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: /130 × 9/ }));
    await user.clear(screen.getByLabelText("Reps"));
    await user.type(screen.getByLabelText("Reps"), "9");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByLabelText("Reps")).toHaveValue("6"));
  });

  it("a swipe whose save fails brings the set back into view", async () => {
    const inner = createMemoryKV({ [V2_KEY]: JSON.stringify(three()) });
    const kv = Object.assign(failing(inner), { dump: inner.dump }) as unknown as Parameters<typeof stored>[0];
    await renderWithStore(<Shell />, { kv, today: TODAY, now: () => Date.parse("2026-10-18T12:00:00") });
    slowClock();
    swipe(setRows()[0]!, 260);
    await new Promise((r) => setTimeout(r, 900)); // the exit animation, then the failed save
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't save/);
    const button = within(setRows()[0]!).getByRole("button");
    await waitFor(() => expect(button.style.transform).toMatch(/^(none|translateX\(0px\))?$/));
    expect(button.style.opacity === "" || button.style.opacity === "1").toBe(true);
  });
});

describe("focus after fixing or removing a set", () => {
  const twoSets = () => doc({ exercises: [row], sessions: [day(TODAY, [["row", sets(130, [10, 9], [2, 1])]])] });
  const rowButton = (i: number) => within(setRows()[i]!).getByRole("button");

  it("Save puts focus back on the set that was fixed", async () => {
    const { user, kv } = await open(twoSets());
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.clear(screen.getByLabelText("Reps"));
    await user.type(screen.getByLabelText("Reps"), "8");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(stored(kv).sessions[0]!.blocks[0]!.sets[0]!.reps).toBe(8));
    await waitFor(() => expect(rowButton(0)).toHaveFocus());
  });

  it("Cancel puts focus back on the set that was being fixed", async () => {
    const { user } = await open(twoSets());
    await user.click(screen.getByRole("button", { name: /130 × 9/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(rowButton(1)).toHaveFocus());
  });

  it("Delete set moves focus to the set that took its place, else the one above", async () => {
    const { user } = await open(twoSets());
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.click(screen.getByRole("button", { name: "Delete set" }));
    await waitFor(() => expect(setRows()).toHaveLength(1));
    await waitFor(() => expect(rowButton(0)).toHaveFocus());
    expect(rowButton(0)).toHaveAccessibleName(/130 × 9/);
  });

  it("deleting the only set moves focus to the weight field", async () => {
    const { user } = await open(doc({ exercises: [row], sessions: [day(TODAY, [["row", sets(130, [10], [2])]])] }));
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.click(screen.getByRole("button", { name: "Delete set" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Sets today" })).toBeNull());
    await waitFor(() => expect(screen.getByLabelText("lb")).toHaveFocus());
  });
});
