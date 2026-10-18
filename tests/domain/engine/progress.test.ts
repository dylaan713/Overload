import { describe, it, expect } from "vitest";
import { targetsFor } from "../../../src/domain/engine/targets";
import type { Exercise, Phase, Session, Style } from "../../../src/domain/types";
import { day, doc, ex, sets } from "../../helpers/build";

const TODAY = "2026-10-20";
const bar = ex("a");
const db = ex("a", { equipment: "dumbbell", class: "isolation" });
const run = (e: Exercise, sessions: Session[], o: { style?: Style; phases?: Phase[]; today?: string } = {}) =>
  targetsFor("a", doc({ exercises: [e], sessions, style: o.phases ? undefined : (o.style ?? "hypertrophy"), phases: o.phases }), o.today ?? TODAY);
const reps = (t: ReturnType<typeof run>) => t.sets.map((s) => s.reps);
const one = (date: string, w: number, r: number[], rir?: number | null) => day(date, [["a", sets(w, r, r.map(() => rir ?? null))]]);

describe("targetsFor: progression", () => {
  it("first time: no weight, the range and target effort", () => {
    const t = run(bar, []);
    expect(t).toMatchObject({ rule: "first-time", weight: null, reason: "First time: pick a weight you can lift for 6–10 reps with 0–2 left." });
    expect(reps(t)).toEqual([6, 6, 6]);
    expect(t.sets[0]).toEqual({ reps: 6, rirLow: 0, rirHigh: 2 });
  });

  it("earn: top of the range on every set moves up one step", () => {
    const t = run(bar, [one("2026-10-01", 225, [10, 10, 10], 1)]);
    expect(t).toMatchObject({ rule: "earn", weight: 230, restSeconds: 120, exerciseId: "a" });
    expect(reps(t)).toEqual([6, 6, 6]);
    expect(t.warmups).toEqual([{ weight: 105, reps: 8 }, { weight: 205, reps: 3 }]);
  });

  it("earn double when every set had 3+ in reserve", () => {
    const t = run(bar, [one("2026-10-01", 225, [10, 10, 10], 3)]);
    expect(t).toMatchObject({ rule: "earn-double", weight: 235 });
    expect(reps(t)).toEqual([6, 6, 6]);
  });

  it("an off-grid W moves to the next grid value", () => {
    expect(run(bar, [one("2026-10-01", 222.5, [10, 10, 10], 1)])).toMatchObject({ rule: "earn", weight: 225 });
  });

  it("too few sets at the top builds instead", () => {
    const t = run(bar, [one("2026-10-01", 225, [10, 10])]);
    expect(t).toMatchObject({ rule: "build-reps", weight: 225 });
    expect(reps(t)).toEqual([10, 10, 10]);
  });

  it("a big relative jump extends the rep target", () => {
    const t = run(db, [one("2026-10-01", 15, [15, 15, 15], 0)]);
    expect(t).toMatchObject({ rule: "extend-reps", weight: 15, reason: "20 lb is a big jump from 15 lb, so build to 21 reps here first." });
    expect(reps(t)).toEqual([16, 16, 16]);
    expect(reps(run(db, [one("2026-10-01", 15, [18, 17, 17], 0)]))).toEqual([18, 18, 18]);
  });

  it("the ceiling forces the move", () => {
    const t = run(db, [one("2026-10-01", 15, [21, 21, 21], 0)]);
    expect(t).toMatchObject({ rule: "earn", weight: 20 });
    expect(reps(t)).toEqual([10, 10, 10]);
  });

  it("build reps bumps the lowest set, by 2 when it was too easy, padded to the style's sets", () => {
    expect(run(bar, [one("2026-10-01", 225, [8, 7, 7], 2)])).toMatchObject({ rule: "build-reps", weight: 225 });
    expect(reps(run(bar, [one("2026-10-01", 225, [8, 7, 7], 2)]))).toEqual([8, 8, 7]);
    expect(reps(run(bar, [one("2026-10-01", 225, [8, 7, 7], 3)]))).toEqual([8, 9, 7]);
    expect(reps(run(bar, [one("2026-10-01", 225, [8, 8])]))).toEqual([9, 8, 8]);
  });

  it("holds reps after a hard session with fewer reps than the one before", () => {
    const t = run(bar, [one("2026-09-28", 200, [5, 5, 4]), one("2026-10-01", 200, [5, 4, 4], 0)], { style: "strength" });
    expect(t).toMatchObject({ rule: "build-reps", weight: 200 });
    expect(reps(t)).toEqual([5, 4, 4]);
  });

  it("W = 0 on an external lift earns on reps alone", () => {
    expect(run(bar, [one("2026-10-01", 0, [10, 10, 10])])).toMatchObject({ rule: "earn", weight: 5 });
  });

  it("bodyweight adds load; assisted removes assistance", () => {
    const bw = run(ex("a", { equipment: "bodyweight", loadKind: "bodyweight" }), [one("2026-10-01", 0, [10, 10, 10])]);
    expect(bw).toMatchObject({ rule: "earn", weight: 5, warmups: [] });
    expect(reps(bw)).toEqual([6, 6, 6]);
    expect(run(ex("a", { equipment: "machine", loadKind: "assisted" }), [one("2026-10-01", 40, [10, 10, 10])])).toMatchObject({ rule: "earn", weight: 35 });
  });

  it("bands build reps uncapped and suggest the next band", () => {
    const t = run(ex("a", { equipment: "band", class: "isolation" }), [one("2026-10-01", 0, [21, 21, 21])]);
    expect(t).toMatchObject({ rule: "build-reps", weight: null, reason: "Reps are past 20, so move to the next band." });
    expect(reps(t)).toEqual([22, 21, 21]);
  });

  it("phase start into strength keeps W and retargets reps", () => {
    const phases: Phase[] = [{ id: "h", style: "hypertrophy", startDate: "2026-09-01" }, { id: "s", style: "strength", startDate: "2026-10-01" }];
    const t = run(bar, [one("2026-09-20", 225, [10, 10, 10], 1)], { phases, today: "2026-10-03" });
    expect(t).toMatchObject({ rule: "phase-start", weight: 225 });
    expect(reps(t)).toEqual([6, 6, 6]);
  });

  it("phase start into hypertrophy steps down until the estimate reaches repLow", () => {
    const phases: Phase[] = [{ id: "s", style: "strength", startDate: "2026-09-01" }, { id: "h", style: "hypertrophy", startDate: "2026-10-01" }];
    const t = run(bar, [one("2026-09-25", 200, [3, 3, 3], 0)], { phases, today: "2026-10-03" });
    expect(t).toMatchObject({ rule: "phase-start", weight: 180 });
    expect(reps(t)).toEqual([6, 6, 6]);
  });

  it("throws for an unknown exercise", () => {
    expect(() => targetsFor("nope", doc({}), TODAY)).toThrow("Unknown exercise nope");
  });
});
