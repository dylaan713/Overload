import { describe, it, expect } from "vitest";
import { EQUIPMENT_STEPS, STYLE_DEFAULTS, defaultSettings } from "../../src/domain/settings";

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
