import { describe, it, expect } from "vitest";
import { changeText } from "../../src/features/progress/format";

describe("changeText", () => {
  it("says an assisted lift isn't scored rather than short of data", () => {
    expect(changeText({ change: null, trend: null, metric: "reps", counts: false }, "lb")).toBe("Assisted, not scored");
  });
  it("keeps the usual words otherwise", () => {
    expect(changeText({ change: null, trend: null, metric: "e1rm", counts: true }, "lb")).toBe("Not enough data yet");
    expect(changeText({ change: -24, trend: "down", metric: "e1rm", counts: true }, "lb")).toBe("−24 lb");
    expect(changeText({ change: 2, trend: "up", metric: "reps", counts: true }, "kg")).toBe("+2 reps");
  });
});
