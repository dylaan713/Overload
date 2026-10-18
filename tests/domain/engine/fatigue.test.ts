import { describe, it, expect } from "vitest";
import { decideFatigue, fatigueActive, fatigueSuggestion } from "../../../src/domain/engine/fatigue";
import { targetsFor } from "../../../src/domain/engine/targets";
import { day, doc, ex, sets } from "../../helpers/build";

const lifts = ["A", "B", "C", "D"];
const mk = (trained: string[]) =>
  doc({
    exercises: lifts.map((id) => ex(id)),
    style: "hypertrophy",
    sessions: [
      day("2026-10-05", trained.map((id) => [id, sets(100, [8, 8, 8])])),
      day("2026-10-12", trained.map((id) => [id, sets(100, id === "A" || id === "B" ? [6, 6, 6] : [8, 8, 8])])),
    ],
  });

describe("whole-body fatigue (rule 6)", () => {
  it("suggests a lighter week when half of 4+ lifts were bad this week", () => {
    expect(fatigueSuggestion(mk(lifts), "2026-10-14")).toEqual({
      weekStart: "2026-10-11", reason: "Most lifts were down this week — take a lighter week?",
    });
  });

  it("needs at least 4 lifts", () => {
    expect(fatigueSuggestion(mk(["A", "B", "C"]), "2026-10-14")).toBeNull();
  });

  it("stays quiet once dismissed", () => {
    expect(fatigueSuggestion(decideFatigue(mk(lifts), "2026-10-11", "dismissed", "2026-10-14"), "2026-10-14")).toBeNull();
  });

  it("an accepted week lightens every lift for 7 days", () => {
    const d = decideFatigue(mk(lifts), "2026-10-11", "accepted", "2026-10-14");
    expect(fatigueActive(d, "2026-10-20")).toBe(true);
    expect(fatigueActive(d, "2026-10-13")).toBe(false);
    const t = targetsFor("A", d, "2026-10-16");
    expect(t).toMatchObject({ rule: "fatigue-week", weight: 90, reason: "Lighter week: 90% and half the sets." });
    expect(t.sets.map((s) => s.reps)).toEqual([6, 6]);
    expect(targetsFor("A", d, "2026-10-21").rule).not.toBe("fatigue-week");
  });

  it("deciding twice for the same week keeps one entry", () => {
    const d = decideFatigue(decideFatigue(mk(lifts), "2026-10-11", "dismissed", "2026-10-14"), "2026-10-11", "accepted", "2026-10-15");
    expect(d.coaching.fatigueWeeks).toEqual([{ weekStart: "2026-10-11", status: "accepted", decidedOn: "2026-10-15" }]);
  });
});
