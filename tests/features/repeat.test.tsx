// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import type { StoreDoc } from "../../src/domain/types";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";

const TODAY = "2026-10-19";
const DATE = "2026-10-16";
const names = ["Bench press", "Incline press", "Chest fly", "Overhead extension", "Pushdown", "Lateral raise"];
const ids = ["bench", "incline", "fly", "ohe", "pushdown", "lateral"];
const exercises = [...ids.map((id, i) => ex(id, { name: names[i]! })), ex("row", { name: "Row", primary: ["lats"] })];
const pushDay = day(DATE, ids.map((id) => [id, sets(100, [10, 10], [1, 1])]));
const base = doc({ exercises, sessions: [pushDay] });

async function setup(d: StoreDoc = base, before?: (ui: Awaited<ReturnType<typeof renderWithStore>>["uiStore"]) => void) {
  const r = await renderWithStore(<Shell />, { doc: d, today: TODAY, now: () => Date.parse(`${TODAY}T12:00:00`) });
  before?.(r.uiStore);
  r.uiStore.getState().openSheet("workout", { arg: DATE });
  const sheet = await screen.findByRole("dialog");
  await r.user.click(within(sheet).getByRole("button", { name: "Repeat this workout" }));
  return r;
}

const upNext = async (r: Awaited<ReturnType<typeof renderWithStore>>) => {
  r.uiStore.getState().openSheet("next-exercise");
  const sheet = await screen.findByRole("dialog");
  const group = within(sheet).queryByRole("region", { name: "Up next" });
  return { sheet, rows: group ? within(group).getAllByRole("button").map((b) => b.textContent ?? "") : [] };
};

describe("Repeat this workout", () => {
  it("puts the first exercise on the Log with its target and queues the rest", async () => {
    const r = await setup();
    expect(r.uiStore.getState().tab).toBe("log");
    expect(screen.getByRole("heading", { level: 2, name: "Bench press" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Target" })).toBeInTheDocument();
    const { rows } = await upNext(r);
    expect(rows.map((t) => names.find((n) => t.startsWith(n)))).toEqual(names.slice(1));
  });

  it("picking a queued exercise takes it off the queue; picking another leaves the queue", async () => {
    const r = await setup();
    let { sheet } = await upNext(r);
    await r.user.click(within(within(sheet).getByRole("region", { name: "Up next" })).getByRole("button", { name: /^Incline press/ }));
    expect(r.uiStore.getState().log.queue!.ids).toEqual(["bench", "fly", "ohe", "pushdown", "lateral"]);
    await screen.findByRole("heading", { level: 2, name: "Incline press" });
    ({ sheet } = await upNext(r));
    await r.user.click(within(sheet).getByRole("button", { name: /^Row/ }));
    expect(r.uiStore.getState().log.queue!.ids).toEqual(["bench", "fly", "ohe", "pushdown", "lateral"]);
  });

  it("keeps the first exercise queued when another is picked first (review I4)", async () => {
    const r = await setup();
    const { sheet } = await upNext(r);
    await r.user.click(within(within(sheet).getByRole("region", { name: "Up next" })).getByRole("button", { name: /^Lateral raise/ }));
    await screen.findByRole("heading", { level: 2, name: "Lateral raise" });
    const { rows } = await upNext(r);
    expect(rows.map((t) => names.find((n) => t.startsWith(n)))).toEqual(["Bench press", "Incline press", "Chest fly", "Overhead extension", "Pushdown"]);
  });

  it("Up next leaves out the exercise in hand and ones already logged today", async () => {
    const r = await setup();
    await r.app.getState().logSet({ day: TODAY, exerciseId: "incline", set: { weight: 60, reps: 10, warmup: false, rir: 1 }, test: false });
    const { rows } = await upNext(r);
    expect(rows.map((t) => names.find((n) => t.startsWith(n)))).toEqual(["Chest fly", "Overhead extension", "Pushdown", "Lateral raise"]);
  });

  it("never overwrites what's typed on the Log", async () => {
    const r = await setup(base, (ui) => ui.getState().setDraft({ day: TODAY, exerciseId: "row", weight: "135" }));
    expect(r.uiStore.getState().log.draft).toMatchObject({ exerciseId: "row", weight: "135" });
    expect(r.uiStore.getState().log.queue!.ids).toEqual(ids);
  });

  it("skips archived exercises and says so", async () => {
    await setup(doc({ exercises: exercises.map((e) => (e.id === "fly" ? { ...e, archived: true } : e)), sessions: [pushDay] }));
    expect(screen.getByRole("status")).toHaveTextContent("Skipped 1 archived exercise");
  });

  it("says when there's nothing left to repeat today", async () => {
    const r = await setup(doc({ exercises, sessions: [pushDay, day(TODAY, ids.map((id) => [id, sets(100, [10])]))] }));
    expect(screen.getByRole("status")).toHaveTextContent("Nothing to repeat");
    expect(r.uiStore.getState().log.queue).toBeNull();
  });

  it("forgets a queue from another day", async () => {
    const r = await renderWithStore(<Shell />, { doc: base, today: TODAY, now: () => Date.parse(`${TODAY}T12:00:00`) });
    r.uiStore.getState().setQueue("2026-10-18", ["fly"]);
    const { rows } = await upNext(r);
    expect(rows).toEqual([]);
  });
});
