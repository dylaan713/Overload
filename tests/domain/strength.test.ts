import { describe, it, expect } from "vitest";
import { e1rm } from "../../src/domain/strength";

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
