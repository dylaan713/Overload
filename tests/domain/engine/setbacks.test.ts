import { describe, it, expect } from "vitest";
import { liftHistory } from "../../../src/domain/engine/history";
import { isBad, stallFireIndex } from "../../../src/domain/engine/setbacks";
import { targetsFor } from "../../../src/domain/engine/targets";
import { STYLE_DEFAULTS } from "../../../src/domain/settings";
import type { Phase, Session, Style } from "../../../src/domain/types";
import { day, doc, ex, sets } from "../../helpers/build";

const one = (date: string, w: number, r: number[], rir: number | null = null) => day(date, [["a", sets(w, r, r.map(() => rir))]]);
const mk = (sessions: Session[], o: { style?: Style; phases?: Phase[] } = {}) =>
  doc({ exercises: [ex("a")], sessions, style: o.phases ? undefined : (o.style ?? "hypertrophy"), phases: o.phases });
const run = (sessions: Session[], today: string, o: { style?: Style; phases?: Phase[] } = {}) => targetsFor("a", mk(sessions, o), today);
const reps = (t: { sets: { reps: number }[] }) => t.sets.map((s) => s.reps);

const stalled = (w: number, r: number[], rir: number | null = 0) =>
  ["2026-10-01", "2026-10-04", "2026-10-07", "2026-10-10"].map((d) => one(d, w, r, rir));
const cooldown = [...stalled(200, [5, 5, 5]), one("2026-10-13", 180, [6, 6, 6]), one("2026-10-16", 200, [5, 5, 5]), one("2026-10-19", 200, [5, 5, 5], 0)];

describe("bad sessions and drops", () => {
  it("one bad session (reps fell by 2) repeats the previous targets", () => {
    const t = run([one("2026-10-01", 225, [8, 8, 8]), one("2026-10-04", 225, [6, 6, 6])], "2026-10-06");
    expect(t).toMatchObject({ rule: "repeat", weight: 225, reason: "Last session was off, so same weight, try again." });
    expect(reps(t)).toEqual([9, 8, 8]);
  });

  it("one bad session (first set under range) repeats", () => {
    expect(run([one("2026-10-01", 225, [8, 8, 8]), one("2026-10-04", 225, [5, 8, 8])], "2026-10-06").rule).toBe("repeat");
  });

  it("never compares sessions at a different W", () => {
    const t = run([one("2026-10-01", 225, [8, 8, 8]), one("2026-10-04", 230, [6, 6, 6])], "2026-10-06");
    expect(t).toMatchObject({ rule: "build-reps", weight: 230 });
    expect(reps(t)).toEqual([7, 6, 6]);
  });

  it("never compares sessions across phases", () => {
    const phases: Phase[] = [{ id: "A", style: "hypertrophy", startDate: "2026-01-01" }, { id: "B", style: "hypertrophy", startDate: "2026-10-04" }];
    const t = run([one("2026-10-01", 225, [8, 8, 8]), one("2026-10-04", 225, [6, 6, 6])], "2026-10-06", { phases });
    expect(t).toMatchObject({ rule: "build-reps", weight: 225 });
    expect(reps(t)).toEqual([7, 6, 6]);
  });

  it("two bad sessions in a row drop one step to repLow", () => {
    const t = run([one("2026-10-01", 225, [9, 9, 9]), one("2026-10-04", 225, [7, 7, 7]), one("2026-10-07", 225, [5, 5, 5])], "2026-10-09");
    expect(t).toMatchObject({ rule: "drop", weight: 220, reason: "Two off sessions in a row, so drop to 220 lb and rebuild." });
    expect(reps(t)).toEqual([6, 6, 6]);
  });

  it("isBad needs the same W and phase", () => {
    const h = liftHistory(mk([one("2026-10-01", 225, [8, 8, 8]), one("2026-10-04", 225, [6, 8, 8])]), "a", "2026-10-06");
    const rules = STYLE_DEFAULTS.hypertrophy.compound;
    expect(isBad(h[0]!, h[1], rules)).toBe(false); // best 8 vs 8, first set 6 ≥ repLow
    expect(isBad(h[0]!, undefined, rules)).toBe(false);
    expect(isBad({ ...h[0]!, best: 6 }, h[1], rules)).toBe(true);
    expect(isBad({ ...h[0]!, best: 6 }, { ...h[1]!, W: 230 }, rules)).toBe(false);
    expect(isBad({ ...h[0]!, best: 6 }, { ...h[1]!, phaseId: "other" }, rules)).toBe(false);
  });
});

describe("stalls", () => {
  it("strength stall deloads to 90% with normal sets", () => {
    const t = run(stalled(200, [5, 5, 5]), "2026-10-12", { style: "strength" });
    expect(t).toMatchObject({ rule: "stall-deload", weight: 180, reason: "No progress on a in 3 sessions." });
    expect(reps(t)).toEqual([6, 6, 6]);
  });

  it("unrated sets stall on performance alone", () => {
    expect(run(stalled(200, [5, 5, 5], null), "2026-10-12", { style: "strength" }).rule).toBe("stall-deload");
  });

  it("sets with reps in reserve are not a stall", () => {
    const t = run(stalled(200, [5, 5, 5], 3), "2026-10-12", { style: "strength" });
    expect(t.rule).toBe("build-reps");
    expect(reps(t)).toEqual([6, 5, 5]);
  });

  it("cooldown: no second stall until 3 more sessions after the response", () => {
    expect(run(cooldown, "2026-10-21", { style: "strength" }).rule).toBe("build-reps");
    expect(run([...cooldown, one("2026-10-22", 200, [5, 5, 5], 0)], "2026-10-24", { style: "strength" }).rule).toBe("stall-deload");
  });

  it("stallFireIndex fires at chronological 3, not 5 or 6, and again at 7", () => {
    const at = (sessions: Session[], today: string) => stallFireIndex(liftHistory(mk(sessions, { style: "strength" }), "a", today));
    expect(at(cooldown.slice(0, 3), "2026-10-21")).toBeNull();
    expect(at(cooldown.slice(0, 4), "2026-10-21")).toBe(0);
    expect(at(cooldown.slice(0, 6), "2026-10-21")).toBe(2); // still the fire at chronological 3
    expect(at(cooldown, "2026-10-21")).toBe(3);
    expect(at([...cooldown, one("2026-10-22", 200, [5, 5, 5], 0)], "2026-10-24")).toBe(0);
  });

  it("hypertrophy stall halves the sets for a week", () => {
    const base = stalled(100, [8, 8, 8]);
    const t = run(base, "2026-10-12");
    expect(t).toMatchObject({ rule: "stall-volume", weight: 100, reason: "No progress on a in 3 sessions. Half the sets this week." });
    expect(reps(t)).toEqual([9, 8]);
    const more = [...base, one("2026-10-13", 100, [8, 8])];
    expect(run(more, "2026-10-15").rule).toBe("stall-volume");
    expect(run(more, "2026-10-18").rule).not.toBe("stall-volume");
  });
});
