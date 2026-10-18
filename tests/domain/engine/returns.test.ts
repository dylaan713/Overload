import { describe, it, expect } from "vitest";
import { targetsFor } from "../../../src/domain/engine/targets";
import type { Exercise, Session } from "../../../src/domain/types";
import { day, doc, ex, sets } from "../../helpers/build";

const one = (date: string, w: number, r: number[]) => day(date, [["a", sets(w, r)]]);
const run = (sessions: Session[], today: string, e: Exercise = ex("a")) =>
  targetsFor("a", doc({ exercises: [e], sessions, style: "hypertrophy" }), today);
const reps = (t: { sets: { reps: number }[] }) => t.sets.map((s) => s.reps);

describe("time off (rule 7)", () => {
  const base = [one("2026-09-01", 225, [8, 8, 8])];

  it("14+ days off starts at 90%, 28+ at 80%, reps at repLow", () => {
    const t = run(base, "2026-09-20");
    expect(t).toMatchObject({ rule: "return", weight: 200, reason: "Welcome back — starting lighter after 19 days off." });
    expect(reps(t)).toEqual([6, 6, 6]);
    expect(run(base, "2026-10-01")).toMatchObject({ rule: "return", weight: 180 });
  });

  it("climbs back to W in two equal steps, then normal rules resume", () => {
    const r1 = [...base, one("2026-09-20", 200, [6, 6, 6])];
    expect(run(r1, "2026-09-23")).toMatchObject({ rule: "return", weight: 215, reason: "Building back to 225 lb." });
    const r2 = [...r1, one("2026-09-23", 215, [6, 6, 6])];
    expect(run(r2, "2026-09-26")).toMatchObject({ rule: "return", weight: 225 });
    const t = run([...r2, one("2026-09-26", 225, [6, 6, 6])], "2026-09-29");
    expect(t.rule).toBe("build-reps");
    expect(reps(t)).toEqual([7, 6, 6]);
  });

  it("assisted adds a step of assistance; bodyweight takes off added load", () => {
    expect(run([one("2026-09-01", 40, [8, 8, 8])], "2026-09-21", ex("a", { equipment: "machine", loadKind: "assisted" })))
      .toMatchObject({ rule: "return", weight: 45 });
    const bw = run([one("2026-09-01", 0, [8, 8, 8])], "2026-09-21", ex("a", { equipment: "bodyweight", loadKind: "bodyweight" }));
    expect(bw).toMatchObject({ rule: "return", weight: 0 });
    expect(reps(bw)).toEqual([6, 6, 6]);
  });
});
