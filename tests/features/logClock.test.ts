import { describe, it, expect } from "vitest";
import { restSince, workoutClock } from "../../src/features/log/clock";

const MIN = 60_000;
const at = (m: number) => Date.parse("2026-10-18T12:00:00") + m * MIN;

describe("the workout clock", () => {
  it("counts up from the first set while the workout is live", () => {
    expect(workoutClock({ startedAt: at(0), lastAt: at(20), endedAt: null, now: at(42) })).toEqual({ ms: 42 * MIN, running: true });
  });

  it("freezes at the workout's length once it's ended, however long ago that was", () => {
    const clocks = { startedAt: at(0), lastAt: at(40), endedAt: at(45), now: at(600) };
    expect(workoutClock(clocks)).toEqual({ ms: 45 * MIN, running: false });
  });

  it("is nothing before the first set", () => {
    expect(workoutClock({ startedAt: null, lastAt: null, endedAt: null, now: at(5) })).toBeNull();
  });

  it("never reads negative when the clock has gone backwards", () => {
    expect(workoutClock({ startedAt: at(10), lastAt: at(10), endedAt: null, now: at(9) })).toEqual({ ms: 0, running: true });
    expect(workoutClock({ startedAt: at(10), lastAt: at(10), endedAt: at(9), now: at(20) })).toEqual({ ms: 0, running: false });
  });
});

describe("the rest counter", () => {
  it("counts up from the last set", () => {
    expect(restSince({ startedAt: at(0), lastAt: at(20), endedAt: null, now: at(22) })).toBe(2 * MIN);
  });

  it("goes once the workout has ended: it isn't rest any more", () => {
    expect(restSince({ startedAt: at(0), lastAt: at(20), endedAt: at(25), now: at(300) })).toBeNull();
  });

  it("is nothing before the first set", () => {
    expect(restSince({ startedAt: null, lastAt: null, endedAt: null, now: at(5) })).toBeNull();
  });
});
