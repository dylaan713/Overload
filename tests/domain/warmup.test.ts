import { describe, it, expect } from "vitest";
import { getWarmupSets } from "../../src/domain/warmup";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Settings } from "../../src/domain/types";
import * as ref from "../reference/legacyEngine.js";

describe("getWarmupSets", () => {
  it("ramps toward the working weight (lb, 2 sets)", () => {
    expect(getWarmupSets("compound", 200, DEFAULT_SETTINGS)).toEqual([
      { weight: 90, reps: 8 },
      { weight: 180, reps: 3 },
    ]);
  });
  it("returns nothing for no target or zero warm-up sets", () => {
    expect(getWarmupSets("compound", null, DEFAULT_SETTINGS)).toEqual([]);
    expect(getWarmupSets("compound", 0, DEFAULT_SETTINGS)).toEqual([]);
    const none: Settings = { ...DEFAULT_SETTINGS, compound: { ...DEFAULT_SETTINGS.compound, warmupSets: 0 } };
    expect(getWarmupSets("compound", 200, none)).toEqual([]);
  });
  it("drops sets that round to nothing or reach the working weight", () => {
    expect(getWarmupSets("compound", 5, DEFAULT_SETTINGS)).toEqual([]);
  });
  it("matches the legacy engine across types, units, counts and weights", () => {
    const targets = [null, undefined, 0, -5, 2.5, 5, 10, 45, 95, 135, 185, 225, 315, 405];
    for (const unit of ["lb", "kg"] as const) {
      for (const count of [0, 1, 2, 3, 4]) {
        const settings: Settings = {
          ...DEFAULT_SETTINGS, unit, increment: unit === "kg" ? 2.5 : 5,
          compound: { ...DEFAULT_SETTINGS.compound, warmupSets: count },
          isolation: { ...DEFAULT_SETTINGS.isolation, warmupSets: count },
        };
        for (const type of ["compound", "isolation"] as const) {
          for (const t of targets) expect(getWarmupSets(type, t, settings)).toEqual(ref.getWarmupSets(type, t, settings));
        }
      }
    }
  });
});
