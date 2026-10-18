import { describe, it, expect } from "vitest";
import { weeklyVolume } from "../../src/domain/volume";
import { day, doc, ex, sets, warm } from "../helpers/build";

const exercises = [
  ex("bench", { primary: ["chest"], secondary: ["front-delts", "triceps"] }),
  ex("lat", { equipment: "dumbbell", class: "isolation", primary: ["side-delts"] }),
  ex("curl", { class: "isolation", primary: ["biceps"] }),
  ex("leg", { primary: ["quads"] }),
];
const d = doc({
  exercises,
  style: "hypertrophy",
  sessions: [
    day("2026-10-01", [["curl", sets(50, [10, 10, 10])]]),
    day("2026-10-10", [["bench", sets(135, [8, 8, 8])]]), // last week
    day("2026-10-12", [
      ["bench", [warm(45, 8), warm(95, 5), ...sets(135, [8, 8, 8])]],
      ["lat", sets(15, [12, 12, 12])],
      ["leg", sets(100, Array(21).fill(10))],
      ["ghost", sets(10, [10])], // unknown exercise, skipped
    ]),
    day("2026-10-13", [["bench", sets(185, [1]), true]]), // test sets count
    day("2026-10-20", [["bench", sets(135, [8, 8, 8])]]), // future
  ],
});

describe("weeklyVolume", () => {
  it("counts primary 1 and secondary 0.5, sorted by shortfall then excess", () => {
    const rows = weeklyVolume(d, "2026-10-14");
    expect(rows.map((r) => [r.label, r.sets])).toEqual([
      ["Biceps", 0], ["Front delts", 2], ["Triceps", 2], ["Side delts", 3], ["Chest", 4], ["Quads", 21],
    ]);
    expect(rows[0]!.suggestion).toBe("Biceps: 0 of 10–20 this week — add 10");
    expect(rows.find((r) => r.label === "Chest")).toMatchObject({ region: "Chest", low: 10, high: 20, status: "under", suggestion: "Chest: 4 of 10–20 this week — add 6" });
    expect(rows.at(-1)).toMatchObject({ status: "over", suggestion: "Quads: 21, above 20 — consider fewer next week" });
  });

  it("prints halves for secondary-only muscles", () => {
    const only = doc({ exercises, style: "hypertrophy", sessions: [day("2026-10-12", [["bench", sets(135, [8, 8, 8])]])] });
    expect(weeklyVolume(only, "2026-10-14").find((r) => r.muscle === "triceps")!.suggestion).toBe("Triceps: 1.5 of 10–20 this week — add 9");
  });

  it("resets on Sunday", () => {
    const rows = weeklyVolume(d, "2026-10-18");
    expect(rows.find((r) => r.muscle === "chest")!.sets).toBe(0);
  });

  it("uses the strength range and shows in-range rows last with no suggestion", () => {
    const s = doc({ exercises, style: "strength", sessions: [day("2026-10-12", [["lat", sets(15, Array(8).fill(10))]])] });
    expect(weeklyVolume(s, "2026-10-14")).toEqual([
      { muscle: "side-delts", label: "Side delts", region: "Shoulders", sets: 8, low: 6, high: 12, status: "in", suggestion: null },
    ]);
  });
});
