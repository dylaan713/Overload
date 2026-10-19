// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { progressSummary } from "../../src/domain/progress";
import type { SetEntry } from "../../src/domain/types";
import { day, doc, ex, sets, warm } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { stored } from "../helpers/seed";

const TODAY = "2026-10-19";
const DATE = "2026-10-16";
const logged: SetEntry = { weight: 84, reps: 8, warmup: false, rir: 1, orig: { weight: 185, unit: "lb" } };
const exercises = [ex("bench", { name: "Bench press" }), ex("lateral", { name: "Lateral raise", primary: ["side-delts"] })];
const history = doc({
  exercises,
  sessions: [
    day("2026-09-01", [["bench", sets(185, [8])]]),
    day("2026-09-20", [["bench", sets(185, [8])]]),
    day(DATE, [["bench", [warm(95, 5), ...sets(185, [8, 7], [1, 0])]], ["lateral", [logged, ...sets(20, [14])]]]),
  ],
});

afterEach(() => vi.restoreAllMocks());

async function openWorkout(d = history) {
  const r = await renderWithStore(<Shell />, { doc: d, today: TODAY, now: () => Date.parse(`${TODAY}T12:00:00`) });
  r.uiStore.getState().openSheet("workout", { arg: DATE });
  const sheet = await screen.findByRole("dialog");
  return { ...r, sheet };
}

describe("workout sheet", () => {
  it("lists each exercise with its working sets", async () => {
    const { sheet } = await openWorkout();
    expect(within(sheet).getByRole("heading", { name: "Friday, Oct 16" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Bench press.*185 × 8, 185 × 7/ })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Lateral raise.*84 × 8, 20 × 14/ })).toBeInTheDocument();
  });

  it("shows every set of an exercise, warm-ups and difficulty included", async () => {
    const { sheet, user } = await openWorkout();
    await user.click(within(sheet).getByRole("button", { name: /Bench press/ }));
    const list = await within(sheet).findByRole("list", { name: "Sets" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual(["W95 × 5Warm-up", "1185 × 8Hard", "2185 × 7All out"]);
  });

  it("fixes a past set, and Progress sees it", async () => {
    const { sheet, user, kv, app } = await openWorkout();
    await user.click(within(sheet).getByRole("button", { name: /Bench press/ }));
    await user.click(await within(sheet).findByRole("button", { name: /185 × 8/ }));
    const weight = await within(sheet).findByLabelText("Weight, lb");
    await user.clear(weight);
    await user.type(weight, "195");
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(stored(kv).sessions[2]!.blocks[0]!.sets[1]).toEqual({ weight: 195, reps: 8, warmup: false, rir: 1 }));
    await user.click(within(sheet).getByRole("button", { name: "Friday, Oct 16" }));
    expect(within(sheet).getByRole("button", { name: /Bench press.*195 × 8, 185 × 7/ })).toBeInTheDocument();
    const bench = progressSummary(app.getState().doc, TODAY).lifts.find((l) => l.exerciseId === "bench")!;
    expect(bench.points.at(-1)!.value).toBe(Math.round(195 * (1 + 9 / 30)));
  });

  it("removes a set by swipe, and Undo brings back the exact set", async () => {
    const { sheet, user, kv } = await openWorkout();
    await user.click(within(sheet).getByRole("button", { name: /Lateral raise/ }));
    const list = await within(sheet).findByRole("list", { name: "Sets" });
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => t);
    const row = within(list).getAllByRole("listitem")[0]!;
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 300, clientY: 10 });
    for (let i = 1; i <= 5; i++) {
      t += 100;
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 300 - (260 * i) / 5, clientY: 10 });
    }
    t += 100;
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 40, clientY: 10 });
    await waitFor(() => expect(stored(kv).sessions[2]!.blocks[1]!.sets).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("Removed set 1");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(stored(kv).sessions[2]!.blocks[1]!.sets[0]).toEqual(logged));
  });

  it("Save lands on the set being fixed even after an Undo shifts positions (review minor 3)", async () => {
    const { sheet, user, kv } = await openWorkout();
    await user.click(within(sheet).getByRole("button", { name: /Bench press/ }));
    const list = await within(sheet).findByRole("list", { name: "Sets" });
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => t);
    const row = within(list).getAllByRole("listitem")[0]!; // the warm-up
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 300, clientY: 10 });
    for (let i = 1; i <= 5; i++) {
      t += 100;
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 300 - (260 * i) / 5, clientY: 10 });
    }
    t += 100;
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 40, clientY: 10 });
    await waitFor(() => expect(stored(kv).sessions[2]!.blocks[0]!.sets).toHaveLength(2));
    vi.restoreAllMocks();
    await user.click(within(sheet).getByRole("button", { name: /185 × 7/ }));
    const reps = await within(sheet).findByLabelText("Reps");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(stored(kv).sessions[2]!.blocks[0]!.sets).toHaveLength(3));
    await user.clear(reps);
    await user.type(reps, "9");
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(stored(kv).sessions[2]!.blocks[0]!.sets.map((s) => `${s.weight}x${s.reps}`)).toEqual(["95x5", "185x8", "185x9"]));
  });

  it("shows bodyweight sets as reps, not 0 × reps", async () => {
    const pull = ex("pull", { name: "Pull-up", equipment: "bodyweight", loadKind: "bodyweight" });
    const d = doc({ exercises: [...exercises, pull], sessions: [day(DATE, [["pull", sets(0, [10, 9])]])] });
    const { sheet } = await openWorkout(d);
    expect(within(sheet).getByRole("button", { name: /Pull-up.*10 reps, 9 reps/ })).toBeInTheDocument();
  });

  it("has a Repeat this workout button", async () => {
    const { sheet } = await openWorkout();
    expect(within(sheet).getByRole("button", { name: "Repeat this workout" })).toBeInTheDocument();
  });
});
