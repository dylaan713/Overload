import { describe, expect, it } from "vitest";
import { bottomGap } from "../../src/app/viewport";

describe("bottomGap", () => {
  it("is the space between a fixed box's bottom and the screen's bottom edge", () => {
    expect(bottomGap(874, 829)).toBe(45);
  });
  it("is 0 when fixed boxes already reach the edge, and never negative", () => {
    expect(bottomGap(874, 874)).toBe(0);
    expect(bottomGap(844, 874)).toBe(0);
  });
  it("rounds sub-pixel layouts", () => {
    expect(bottomGap(874, 828.6)).toBe(45);
  });
});
