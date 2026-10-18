import { describe, it, expect } from "vitest";
import { targetsFor } from "../../../src/domain/engine/targets";
import { addDays } from "../../../src/domain/dates";
import type { Exercise, Phase, Rir, StoreDoc, Style } from "../../../src/domain/types";
import { day, doc, ex, sets } from "../../helpers/build";

// Logs exactly what the engine suggests (capped by what the lifter can do), every `gap` days, and returns the rules seen.
function simulate(d: StoreDoc, start: string, count: number, o: { gap?: number; rir: Rir; cap?: (w: number) => number }) {
  const rules: string[] = [];
  let date = start;
  for (let i = 0; i < count; i++) {
    const t = targetsFor("a", d, date);
    rules.push(t.rule);
    const reps = t.sets.map((s) => Math.min(s.reps, o.cap?.(t.weight ?? 0) ?? Infinity));
    d.sessions.push(day(date, [["a", sets(t.weight ?? 0, reps, reps.map(() => o.rir))]]));
    date = addDays(date, o.gap ?? 3);
  }
  return rules;
}
const start = (e: Exercise, w: number, r: number[], rir: Rir, o: { style?: Style; phases?: Phase[] } = {}) =>
  doc({ exercises: [e], style: o.phases ? undefined : (o.style ?? "hypertrophy"), phases: o.phases, sessions: [day("2026-10-01", [["a", sets(w, r, r.map(() => rir))]])] });

describe("scenarios", () => {
  it("steady hypertrophy squat builds reps, then earns", () => {
    const d = start(ex("a"), 225, [8, 8, 8], 2);
    expect(simulate(d, "2026-10-04", 8, { rir: 2 })).toEqual([...Array(6).fill("build-reps"), "earn", "build-reps"]);
    expect(d.sessions.at(-1)!.blocks[0]!.sets[0]!.weight).toBe(230);
  });

  it("a lateral raise extends to the ceiling, then earns", () => {
    const d = start(ex("a", { equipment: "dumbbell", class: "isolation", primary: ["side-delts"] }), 15, [15, 15, 15], 0);
    expect(simulate(d, "2026-10-04", 8, { rir: 0 })).toEqual([...Array(6).fill("extend-reps"), "earn", "build-reps"]);
    expect(d.sessions.at(-1)!.blocks[0]!.sets[0]!.weight).toBe(20);
  });

  it("a strength stall deloads, then rebuilds", () => {
    const d = start(ex("a"), 200, [5, 5, 5], 0, { style: "strength" });
    const rules = simulate(d, "2026-10-04", 6, { rir: 0, cap: (w) => (w >= 200 ? 5 : 99) });
    expect(rules).toEqual(["build-reps", "build-reps", "build-reps", "stall-deload", "earn", "build-reps"]);
  });

  it("a layoff ramps back, then normal rules resume", () => {
    const d = start(ex("a"), 225, [8, 8, 8], 2);
    expect(simulate(d, "2026-10-20", 4, { rir: 2 })).toEqual(["return", "return", "return", "build-reps"]);
    expect(d.sessions.slice(1).map((s) => s.blocks[0]!.sets[0]!.weight)).toEqual([200, 215, 225, 225]);
  });

  it("a phase change mid-run produces exactly one phase start", () => {
    const phases: Phase[] = [{ id: "h", style: "hypertrophy", startDate: "2026-01-01" }, { id: "s", style: "strength", startDate: "2026-10-10" }];
    const d = start(ex("a"), 225, [8, 8, 8], 2, { phases });
    const rules = simulate(d, "2026-10-04", 6, { rir: 2 });
    expect(rules.filter((r) => r === "phase-start")).toHaveLength(1);
    expect(rules[2]).toBe("phase-start");
  });
});
