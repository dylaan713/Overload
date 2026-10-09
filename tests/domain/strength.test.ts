import { describe, it, expect } from "vitest";
import { e1rm } from "../../src/domain/strength";
import * as ref from "../reference/legacyEngine.js";

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
  it("matches the legacy engine across a grid", () => {
    for (let weight = 0; weight <= 500; weight += 2.5) {
      for (let reps = -1; reps <= 30; reps++) expect(e1rm(weight, reps)).toBe(ref.e1rm(weight, reps));
    }
  });
});
