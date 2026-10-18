import { describe, it, expect } from "vitest";
import {
  EQUIPMENT_STEPS, STYLE_DEFAULTS, convertUnits, defaultSettings, floorTo, heavier, lighter, loadStep, nearestTo, phaseOf, rulesFor,
} from "../../src/domain/settings";
import type { Phase } from "../../src/domain/types";
import { day, doc, ex, sets } from "../helpers/build";

describe("defaultSettings", () => {
  it("has the spec's style rules, steps and one hypertrophy phase", () => {
    const s = defaultSettings("2026-09-01");
    expect(s.unit).toBe("lb");
    expect(s.theme).toBe("system");
    expect(s.phases).toEqual([{ id: "phase-2026-09-01", style: "hypertrophy", startDate: "2026-09-01" }]);
    expect(s.styles.strength).toEqual({
      compound: { repLow: 3, repHigh: 6, sets: 3, rirLow: 1, rirHigh: 2, restSeconds: 180, warmupSets: 3 },
      isolation: { repLow: 6, repHigh: 10, sets: 3, rirLow: 1, rirHigh: 2, restSeconds: 120, warmupSets: 1 },
      volume: { low: 6, high: 12 },
    });
    expect(s.styles.hypertrophy).toEqual({
      compound: { repLow: 6, repHigh: 10, sets: 3, rirLow: 0, rirHigh: 2, restSeconds: 120, warmupSets: 2 },
      isolation: { repLow: 10, repHigh: 15, sets: 3, rirLow: 0, rirHigh: 2, restSeconds: 90, warmupSets: 1 },
      volume: { low: 10, high: 20 },
    });
    expect(s.equipmentSteps).toEqual({
      barbell: 5, smith: 5, "ez-bar": 5, "trap-bar": 5, dumbbell: 5, machine: 10, cable: 5,
      kettlebell: 9, plate: 10, bodyweight: 5, band: 0,
    });
    expect(EQUIPMENT_STEPS.kg).toEqual({
      barbell: 2.5, smith: 2.5, "ez-bar": 2.5, "trap-bar": 2.5, dumbbell: 2, machine: 5, cable: 2.5,
      kettlebell: 4, plate: 5, bodyweight: 2.5, band: 0,
    });
    expect(defaultSettings("2026-09-01", "kg").equipmentSteps.dumbbell).toBe(2);
  });

  it("returns copies: mutating the result leaves the defaults alone", () => {
    const s = defaultSettings("2026-09-01");
    s.styles.strength.compound.repLow = 99;
    s.equipmentSteps.barbell = 99;
    expect(STYLE_DEFAULTS.strength.compound.repLow).toBe(3);
    expect(EQUIPMENT_STEPS.lb.barbell).toBe(5);
  });
});

const s = defaultSettings("2026-09-01");
const phases: Phase[] = [
  { id: "a", style: "hypertrophy", startDate: "2026-09-01" },
  { id: "b", style: "strength", startDate: "2026-10-01" },
];

describe("phases and rules", () => {
  it("phaseOf picks the latest phase started on or before the date", () => {
    expect(phaseOf({ ...s, phases }, "2026-10-01").id).toBe("b");
    expect(phaseOf({ ...s, phases }, "2026-09-30").id).toBe("a");
    expect(phaseOf({ ...s, phases }, "2026-01-01").id).toBe("a"); // before every phase → earliest
    expect(phaseOf({ ...s, phases: [...phases].reverse() }, "2026-10-05").id).toBe("b"); // order-independent
  });
  it("rulesFor returns the phase style's class rules and volume", () => {
    expect(rulesFor(ex("sq"), { ...s, phases }, "2026-10-05")).toMatchObject({
      style: "strength", repLow: 3, repHigh: 6, sets: 3, restSeconds: 180, volume: { low: 6, high: 12 },
    });
    expect(rulesFor(ex("r", { class: "isolation" }), { ...s, phases }, "2026-09-05")).toMatchObject({ style: "hypertrophy", repLow: 10, repHigh: 15 });
  });
});

describe("load steps", () => {
  it("uses the override, else the equipment default", () => {
    expect(loadStep(ex("db", { equipment: "dumbbell" }), s)).toBe(5);
    expect(loadStep(ex("db", { equipment: "dumbbell", step: 2.5 }), s)).toBe(2.5);
    expect(loadStep(ex("ap", { equipment: "machine", loadKind: "assisted" }), s)).toBe(5); // assistance moves in bodyweight steps (spec table)
  });
  it("floors and rounds to the grid with float tolerance", () => {
    expect(floorTo(224.99999999999, 5)).toBe(225);
    expect(floorTo(222.5, 5)).toBe(220);
    expect(nearestTo(222.6, 5)).toBe(225);
    expect(floorTo(7.5, 2.5)).toBe(7.5);
  });
  it("heavier moves to the next grid value", () => {
    expect(heavier(ex("a"), 222.5, 5)).toBe(225); // off-grid W → next grid value
    expect(heavier(ex("a"), 225, 5, 2)).toBe(235);
    expect(heavier(ex("p", { loadKind: "bodyweight" }), 0, 5)).toBe(5);
    expect(heavier(ex("p", { loadKind: "assisted" }), 40, 5)).toBe(35);
    expect(heavier(ex("p", { loadKind: "assisted" }), 0, 5)).toBe(0);
    expect(heavier(ex("p", { loadKind: "assisted" }), 18.1, 2.5)).toBe(17.5); // off-grid assistance → next grid value below
  });
  it("lighter means easier and never goes below one step on external lifts", () => {
    expect(lighter(ex("a"), 225, 5, { pct: 0.9 })).toBe(200); // 202.5 → 200
    expect(lighter(ex("a"), 225, 5, { steps: 1 })).toBe(220);
    expect(lighter(ex("a"), 5, 5, { pct: 0.9 })).toBe(5);
    expect(lighter(ex("p", { loadKind: "bodyweight" }), 0, 5, { pct: 0.9 })).toBe(0);
    expect(lighter(ex("p", { loadKind: "assisted" }), 40, 5, { steps: 2 })).toBe(50);
  });
});

describe("convertUnits", () => {
  const d = doc({ exercises: [ex("a", { step: 2.5 })], sessions: [day("2026-09-02", [["a", [...sets(225, [5]), ...sets(0, [10])]]])] });
  it("converts logged weights, resets steps and clears overrides", () => {
    const r = convertUnits(d, "kg");
    expect(r.changedSets).toBe(1);
    expect(r.doc.sessions[0]!.blocks[0]!.sets.map((x) => x.weight)).toEqual([102.1, 0]);
    expect(r.doc.settings.unit).toBe("kg");
    expect(r.doc.settings.equipmentSteps.dumbbell).toBe(2);
    expect(r.doc.exercises[0]!.step).toBeNull();
    expect(d.sessions[0]!.blocks[0]!.sets[0]!.weight).toBe(225); // input untouched
    expect(convertUnits(r.doc, "lb").doc.sessions[0]!.blocks[0]!.sets[0]!.weight).toBe(225.1); // 102.1 × 2.2046 = 225.09…, documented drift
  });
  it("is a no-op for the current unit", () => {
    expect(convertUnits(d, "lb")).toEqual({ doc: d, changedSets: 0 });
  });
});
