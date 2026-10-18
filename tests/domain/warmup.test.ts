import { describe, it, expect } from "vitest";
import { warmupRamp } from "../../src/domain/warmup";

describe("warmupRamp", () => {
  it("ramps toward the target, rounded to the step", () => {
    expect(warmupRamp(230, 2, 5)).toEqual([{ weight: 105, reps: 8 }, { weight: 205, reps: 3 }]);
    expect(warmupRamp(200, 1, 5)).toEqual([{ weight: 120, reps: 6 }]); // single set sits at t = 0.33 (~60%)
  });
  it("returns nothing for a missing target, zero count or zero step", () => {
    expect(warmupRamp(null, 2, 5)).toEqual([]);
    expect(warmupRamp(200, 0, 5)).toEqual([]);
    expect(warmupRamp(200, 2, 0)).toEqual([]);
  });
  it("drops sets that round to 0 or reach the target", () => {
    expect(warmupRamp(10, 2, 5)).toEqual([{ weight: 5, reps: 8 }]);
  });
});
