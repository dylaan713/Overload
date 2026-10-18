import { describe, it, expect } from "vitest";
import { targetsFor } from "../../../src/domain/engine/targets";
import { addDays } from "../../../src/domain/dates";
import { EQUIPMENT_STEPS } from "../../../src/domain/settings";
import { EQUIPMENT, type Equipment, type LoadKind, type Phase, type Rir, type Unit } from "../../../src/domain/types";
import { day, doc, ex, sets } from "../../helpers/build";

// Deterministic PRNG so failures reproduce.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}
const onGrid = (w: number, step: number) => Math.abs(w / step - Math.round(w / step)) < 1e-6;

describe("every suggested weight is on the step grid", () => {
  it("holds for random off-grid histories across equipment, load kinds, units and rules", () => {
    const r = rng(42);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
    let checked = 0;
    for (let i = 0; i < 600; i++) {
      const unit: Unit = pick(["lb", "kg"] as const);
      const equipment: Equipment = pick(EQUIPMENT.filter((e) => e !== "band"));
      const loadKind: LoadKind = pick(["external", "external", "bodyweight", "assisted"] as const);
      const override = r() < 0.2 ? pick([1.25, 2.5, 10]) : null;
      const e = ex("a", { equipment, loadKind, class: pick(["compound", "isolation"] as const), step: override });
      const step = override ?? EQUIPMENT_STEPS[unit][loadKind === "assisted" ? "bodyweight" : equipment];
      const base = Math.round((5 + r() * 200) * 10) / 10; // usually off-grid, like a converted unit
      const sessions = [];
      let date = "2026-09-01";
      for (let k = 0; k < 1 + Math.floor(r() * 6); k++) {
        const w = r() < 0.7 ? base : Math.round(base * (0.8 + r() * 0.4) * 10) / 10;
        const reps = Array.from({ length: 1 + Math.floor(r() * 4) }, () => 1 + Math.floor(r() * 22));
        sessions.push(day(date, [["a", sets(w, reps, reps.map(() => (r() < 0.5 ? null : (Math.floor(r() * 5) as Rir))))]]));
        date = addDays(date, pick([2, 3, 3, 7, 16, 30]));
      }
      const phases: Phase[] = r() < 0.3
        ? [{ id: "x", style: "strength", startDate: "2026-01-01" }, { id: "y", style: "hypertrophy", startDate: date }]
        : [{ id: "x", style: pick(["strength", "hypertrophy"] as const), startDate: "2026-01-01" }];
      const d = doc({ exercises: [e], sessions, phases, unit });
      const today = addDays(date, pick([0, 1, 2, 15, 29]));
      const t = targetsFor("a", d, today, { test: r() < 0.1 });
      for (const w of [t.weight, ...(t.ladder ?? []), ...t.warmups.map((x) => x.weight)]) {
        if (w === null) continue;
        checked++;
        expect(onGrid(w, step), `${t.rule} ${w} on step ${step} (${equipment}/${loadKind}/${unit})`).toBe(true);
        if (loadKind === "external" && t.weight !== null && t.weight > 0) expect(w).toBeGreaterThanOrEqual(step);
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});

describe("a zero step can't hang the engine", () => {
  it("phase start with step 0 returns", () => {
    const phases: Phase[] = [{ id: "s", style: "strength", startDate: "2026-01-01" }, { id: "h", style: "hypertrophy", startDate: "2026-10-02" }];
    const d = doc({ exercises: [ex("a")], phases, sessions: [day("2026-10-01", [["a", sets(100, [5, 5, 5], [0, 0, 0])]])] });
    d.settings.equipmentSteps.barbell = 0; // bypasses validation, as a direct caller could
    expect(targetsFor("a", d, "2026-10-03").rule).toBe("phase-start");
  });
});
