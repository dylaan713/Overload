import { describe, it, expect } from "vitest";
import { FLICK, commitOnRelease, project, rubberband, velocityFrom } from "../../src/ui/gesture";

describe("gesture physics", () => {
  it("projects momentum with Apple's deceleration", () => {
    expect(project(1000)).toBeCloseTo(499, 0); // 1 × 0.998 / 0.002
    expect(project(-1500)).toBeCloseTo(-748.5, 1);
    expect(project(1000, 0.99)).toBeCloseTo(99, 0);
  });

  it("rubber-bands past a boundary, keeping the sign", () => {
    expect(rubberband(100, 800)).toBeCloseTo(51.46, 1); // 100·800·0.55 / (800 + 55)
    expect(rubberband(-100, 800)).toBeCloseTo(-51.46, 1);
    expect(rubberband(0, 800)).toBe(0);
  });

  it("commits on the projected end, and the velocity sign wins", () => {
    expect(commitOnRelease(100, 0, 600)).toBe(false); // slow, not past half
    expect(commitOnRelease(350, 0, 600)).toBe(true); // past half
    expect(commitOnRelease(100, 1500, 600)).toBe(true); // flick: projects to ~848
    expect(commitOnRelease(400, -800, 600)).toBe(false); // moving back: the sign wins
    expect(commitOnRelease(400, -100, 600)).toBe(true); // drifting back slowly still projects past half (≈350)
    expect(commitOnRelease(400, -FLICK - 1, 600)).toBe(false); // a deliberate flick back never commits
  });

  it("measures release velocity from the last 100ms of samples", () => {
    expect(velocityFrom([{ t: 0, v: 0 }, { t: 50, v: 25 }, { t: 100, v: 50 }])).toBeCloseTo(500); // px/s
    expect(velocityFrom([{ t: 0, v: 0 }, { t: 400, v: 0 }, { t: 450, v: 30 }])).toBeCloseTo(600); // old samples ignored
    expect(velocityFrom([{ t: 0, v: 10 }])).toBe(0);
    expect(velocityFrom([])).toBe(0);
  });
});
