// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import type { StoreDoc } from "../../src/domain/types";
import { day, doc, ex, sets, warm } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { stored } from "../helpers/seed";

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
    const { user, kv } = await open(d);
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("button", { name: /130 × 10/ }));
    await user.type(screen.getByLabelText("Reps"), "5");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(kv.dump()[V2_KEY]).toBe(before);
    expect(screen.getByLabelText("Reps")).toHaveValue("");
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
