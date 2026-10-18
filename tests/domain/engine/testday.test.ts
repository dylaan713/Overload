import { describe, it, expect } from "vitest";
import { bestTest } from "../../../src/domain/engine/testday";
import { targetsFor } from "../../../src/domain/engine/targets";
import { day, doc, ex, sets } from "../../helpers/build";

const base = () => doc({ exercises: [ex("a")], style: "strength", sessions: [day("2026-10-01", [["a", sets(225, [5, 5, 5], [1, 1, 1])]])] });

describe("test day (rule 9)", () => {
  it("works up to ~95% of the estimated max", () => {
    const t = targetsFor("a", base(), "2026-10-03", { test: true });
    expect(t).toMatchObject({ rule: "test-day", ladder: [215, 235, 255], weight: 255 });
    expect(t.sets).toEqual([1, 2, 3].map(() => ({ reps: 1, rirLow: 1, rirHigh: 2 })));
  });

  it("test blocks never feed progression, but count as records", () => {
    const d = base();
    d.sessions.push(day("2026-10-03", [["a", sets(255, [1]), true]]));
    const t = targetsFor("a", d, "2026-10-05");
    expect(t).toMatchObject({ rule: "build-reps", weight: 225 });
    expect(t.sets.map((s) => s.reps)).toEqual([6, 5, 5]);
    expect(bestTest(d, "a")).toEqual({ weight: 255, reps: 1, date: "2026-10-03", e1rm: 264 });
    expect(bestTest(base(), "a")).toBeNull();
  });

  it("needs history, and isn't offered for bodyweight lifts", () => {
    const empty = targetsFor("a", doc({ exercises: [ex("a")] }), "2026-10-03", { test: true });
    expect(empty).toMatchObject({ rule: "test-day", weight: null, ladder: [], reason: "Log a few sessions of this lift first, so there's a max to test." });
    const bw = doc({ exercises: [ex("a", { equipment: "bodyweight", loadKind: "bodyweight" })], sessions: [day("2026-10-01", [["a", sets(0, [8, 8, 8])]])] });
    expect(targetsFor("a", bw, "2026-10-03", { test: true }).rule).not.toBe("test-day");
  });
});
