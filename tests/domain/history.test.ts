import { describe, it, expect } from "vitest";
import { beats, liftHistory } from "../../src/domain/engine/history";
import { day, doc, ex, sets, warm } from "../helpers/build";

describe("liftHistory", () => {
  const d = doc({
    exercises: [ex("a"), ex("b")],
    phases: [{ id: "p1", style: "hypertrophy", startDate: "2026-01-01" }, { id: "p2", style: "strength", startDate: "2026-09-02" }],
    sessions: [
      day("2026-09-01", [["a", [warm(45, 8), ...sets(100, [8, 8])]]]),
      day("2026-09-03", [["a", sets(100, [9])], ["b", sets(50, [10])], ["a", sets(110, [5])]]), // two blocks the same day → merged in order
      day("2026-09-04", [["a", sets(130, [1]), true]]), // test block → skipped
      day("2026-09-05", [["a", [warm(45, 8)]]]), // warm-up only → skipped
      day("2026-12-01", [["a", sets(200, [5])]]), // after today → skipped
    ],
  });
  const h = liftHistory(d, "a", "2026-09-10");

  it("is newest first and skips test, warm-up-only and future days", () => {
    expect(h.map((x) => x.date)).toEqual(["2026-09-03", "2026-09-01"]);
  });
  it("merges same-day blocks and reads W, atW and best", () => {
    expect(h[0]).toMatchObject({ W: 110, best: 5, phaseId: "p2" });
    expect(h[0]!.sets.map((s) => s.weight)).toEqual([100, 110]);
    expect(h[0]!.atW.map((s) => s.reps)).toEqual([5]);
    expect(h[1]).toMatchObject({ W: 100, best: 8, phaseId: "p1" });
  });
});

describe("beats", () => {
  it("is heavier, or the same weight with more reps", () => {
    expect(beats({ W: 105, best: 1 }, { W: 100, best: 9 })).toBe(true);
    expect(beats({ W: 100, best: 10 }, { W: 100, best: 9 })).toBe(true);
    expect(beats({ W: 100, best: 9 }, { W: 100, best: 9 })).toBe(false);
    expect(beats({ W: 95, best: 20 }, { W: 100, best: 9 })).toBe(false);
  });
});
