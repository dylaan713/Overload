import { describe, it, expect } from "vitest";
import { displayE1rm, e1rm, effectiveReps, predictE1rm, repsAt } from "../../src/domain/strength";
import { sets, warm } from "../helpers/build";

describe("e1rm", () => {
  it("applies Epley and rounds", () => {
    expect(e1rm(100, 10)).toBe(133);
    expect(e1rm(135, 8)).toBe(171);
  });
  it("returns 0 for missing or non-positive inputs", () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
    expect(e1rm(100, -3)).toBe(0);
  });
});

describe("effort-aware estimates", () => {
  it("effectiveReps adds reps in reserve (4 = 4+)", () => {
    expect(effectiveReps({ weight: 100, reps: 8, warmup: false, rir: 2 })).toBe(10);
    expect(effectiveReps({ weight: 100, reps: 8, warmup: false, rir: null })).toBe(8);
    expect(effectiveReps({ weight: 100, reps: 8, warmup: false, rir: 4 })).toBe(12);
  });
  it("predictE1rm is uncapped and 0 without weight", () => {
    expect(predictE1rm({ weight: 225, reps: 10, warmup: false, rir: 1 })).toBeCloseTo(307.5);
    expect(predictE1rm({ weight: 15, reps: 21, warmup: false, rir: 0 })).toBeCloseTo(25.5);
    expect(predictE1rm({ weight: 0, reps: 10, warmup: false, rir: 0 })).toBe(0);
  });
  it("displayE1rm prefers sets of ≤ 12 effective reps, else caps at 12, and ignores warm-ups", () => {
    expect(displayE1rm(sets(15, [21, 21], [0, 0]))).toBe(21); // capped at 12: 15 × 1.4
    expect(displayE1rm(sets(225, [5], [1]))).toBe(270);
    expect(displayE1rm([warm(300, 5), ...sets(200, [20]), ...sets(180, [8])])).toBe(228); // 180 × 1.2667; the 20-rep set doesn't qualify
    expect(displayE1rm([warm(300, 5)])).toBe(0);
  });
  it("repsAt inverts Epley", () => {
    expect(repsAt(230, 307.5)).toBe(10);
    expect(repsAt(20, 25.5)).toBe(8);
    expect(repsAt(225, 307.5)).toBe(11); // exact boundary, needs the epsilon
    expect(repsAt(0, 300)).toBe(0);
    expect(repsAt(300, 200)).toBe(0);
  });
});
