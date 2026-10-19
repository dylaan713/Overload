import { describe, it, expect } from "vitest";
import { strengthMap, weekLine, weekMap } from "../../src/domain/muscleMap";
import { MUSCLES } from "../../src/domain/types";
import { day, doc, ex, sets } from "../helpers/build";

const TODAY = "2026-10-19"; // Monday; the week began Sunday 2026-10-18

describe("weekMap", () => {
  const d = doc({
    style: "hypertrophy", // 10–20
    exercises: [
      ex("curl", { primary: ["biceps"] }),
      ex("push", { primary: ["triceps"] }),
      ex("lat", { primary: ["side-delts"] }),
      ex("ohp", { primary: ["front-delts"], secondary: ["side-delts"] }),
      ex("bench", { primary: ["chest"] }),
      ex("squat", { primary: ["quads"] }),
      ex("rdl", { primary: ["hamstrings"] }),
      ex("calf", { primary: ["calves"] }),
    ],
    sessions: [
      day("2026-09-01", [["calf", sets(100, [10])]]),
      day("2026-10-18", [["curl", sets(30, Array(4).fill(10))], ["push", sets(30, Array(5).fill(10))], ["lat", sets(15, Array(9).fill(12))], ["ohp", sets(95, [8])]]),
      day("2026-10-19", [["bench", sets(135, Array(10).fill(8))], ["squat", sets(185, Array(20).fill(8))], ["rdl", sets(185, Array(21).fill(8))]]),
    ],
  });
  const m = weekMap(d, TODAY);

  it("has a cell for every muscle", () => {
    expect(Object.keys(m).sort()).toEqual([...MUSCLES].sort());
  });
  it("grades sets against the style's range", () => {
    expect(m.biceps).toEqual({ state: "under-half", sets: 4, low: 10, high: 20, stalled: false });
    expect(m.triceps.state).toBe("almost");
    expect(m["side-delts"]).toMatchObject({ state: "almost", sets: 9.5 });
    expect(m.chest.state).toBe("in");
    expect(m.quads.state).toBe("in");
    expect(m.hamstrings.state).toBe("over");
  });
  it("marks a muscle stalled when its counted lifts are flat or falling", () => {
    const four = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"];
    const flat = doc({ style: "hypertrophy", exercises: [ex("squat", { primary: ["quads"] })], sessions: four.map((date) => day(date, [["squat", sets(185, Array(24).fill(8))]])) });
    expect(weekMap(flat, TODAY).quads.stalled).toBe(true);
  });

  it("shows untrained muscles as none", () => {
    expect(m.calves).toEqual({ state: "none", sets: 0, low: 10, high: 20, stalled: false });
    expect(m.abs.state).toBe("none");
  });
});

describe("strengthMap", () => {
  const dates = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"];
  const d = doc({
    exercises: [
      ex("bench", { primary: ["chest"], secondary: ["triceps"] }),
      ex("fly", { class: "isolation", primary: ["chest"] }),
      ex("row", { primary: ["lats"] }),
    ],
    sessions: dates.map((date, i) =>
      day(date, [
        ["bench", sets(i < 2 ? 150 : 160, [8])], // +6.8%
        ["fly", sets(100, [i < 3 ? 10 : 11])], // +3.0%
        ...(i < 2 ? [["row", sets(135, [8])] as [string, ReturnType<typeof sets>]] : []),
      ]),
    ),
  });
  const m = strengthMap(d, TODAY);

  it("averages the change of the lifts that mainly work a muscle", () => {
    expect(m.chest.state).toBe("up");
    expect(m.chest.lifts.map((l) => l.exerciseId).sort()).toEqual(["bench", "fly"]);
  });
  it("needs a counted lift", () => {
    expect(m.lats).toEqual({ state: "no-data", lifts: [] });
  });
  it("doesn't credit secondary muscles", () => {
    expect(m.triceps.state).toBe("no-data");
  });
});

describe("weekLine", () => {
  it("says how many sets to add when short", () => {
    expect(weekLine("side-delts", { state: "under-half", sets: 2, low: 10, high: 20, stalled: false })).toBe("Side delts · 2 of 10–20 sets this week · add 8");
    expect(weekLine("chest", { state: "almost", sets: 9.5, low: 10, high: 20, stalled: false })).toBe("Chest · 9.5 of 10–20 sets this week · add 1");
  });
  it("only suggests fewer when over and the muscle's lifts aren't improving", () => {
    expect(weekLine("quads", { state: "over", sets: 24, low: 10, high: 20, stalled: true })).toBe("Quads · 24, above 20 and not improving — try fewer next week");
    expect(weekLine("quads", { state: "over", sets: 24, low: 10, high: 20, stalled: false })).toBe("Quads · 24, above 20 · fine while lifts improve");
  });
  it("just states the count when in range or none", () => {
    expect(weekLine("chest", { state: "in", sets: 12, low: 10, high: 20, stalled: false })).toBe("Chest · 12 of 10–20 sets this week");
    expect(weekLine("abs", { state: "none", sets: 0, low: 10, high: 20, stalled: false })).toBe("Abs · 0 of 10–20 sets this week · add 10");
  });
});
