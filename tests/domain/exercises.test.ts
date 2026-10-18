import { describe, it, expect } from "vitest";
import { REGIONS, deleteExerciseCascade, groupByRegion, libraryState, regionOf, sessionsWithExercise } from "../../src/domain/exercises";
import { day, doc, ex, sets } from "../helpers/build";

const raise = ex("raise", { name: "Lateral raise", primary: ["side-delts"], class: "isolation" });
const bench = ex("bench", { name: "Bench press", primary: ["chest"] });
const arnold = ex("arnold", { name: "Arnold press", primary: ["front-delts"] });
const curl = ex("curl", { name: "Curl", primary: ["biceps"], archived: true });

describe("groupByRegion", () => {
  it("groups by the first primary muscle's region, in REGIONS order, names sorted", () => {
    expect(regionOf(raise)).toBe("Shoulders");
    expect(groupByRegion([raise, curl, bench, arnold])).toEqual([
      { region: "Chest", exercises: [bench] },
      { region: "Shoulders", exercises: [arnold, raise] },
    ]);
    expect(REGIONS).toEqual(["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"]);
  });

  it("lists only archived exercises with archived: true", () => {
    expect(groupByRegion([raise, curl], { archived: true })).toEqual([{ region: "Arms", exercises: [curl] }]);
  });
});

describe("cascade delete and usage", () => {
  const d = doc({
    exercises: [ex("a"), ex("b")],
    sessions: [
      day("2026-09-01", [["a", sets(100, [5])], ["b", sets(50, [5])]]),
      day("2026-09-02", [["a", sets(100, [5])], ["a", sets(90, [5])]]),
    ],
  });

  it("removes the exercise, its blocks and sessions left empty", () => {
    const r = deleteExerciseCascade(d, "a");
    expect(r.exercises.map((e) => e.id)).toEqual(["b"]);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0]!.blocks.map((b) => b.exerciseId)).toEqual(["b"]);
  });

  it("counts sessions, not blocks", () => {
    expect(sessionsWithExercise(d, "a")).toBe(2);
    expect(sessionsWithExercise(d, "b")).toBe(1);
    expect(sessionsWithExercise(d, "zzz")).toBe(0);
  });
});

describe("libraryState", () => {
  const d = doc({
    exercises: [
      ex("x1", { libraryId: "bench-press.barbell" }),
      ex("x2", { libraryId: "curl.ez-bar", archived: true }),
    ],
  });
  it("reports new, added and archived", () => {
    expect(libraryState(d, "squat.barbell")).toEqual({ status: "new" });
    expect(libraryState(d, "bench-press.barbell")).toEqual({ status: "added", exerciseId: "x1" });
    expect(libraryState(d, "curl.ez-bar")).toEqual({ status: "archived", exerciseId: "x2" });
  });
});
