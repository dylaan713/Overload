import { describe, it, expect } from "vitest";
import { daySummary, latestTrainingDay, repeatQueue, trainingDays } from "../../src/domain/historyDays";
import { day, doc, ex, sets, warm } from "../helpers/build";

const push = [
  ex("bench", { primary: ["chest"], secondary: ["triceps", "front-delts"] }),
  ex("incline", { primary: ["chest"] }),
  ex("fly", { primary: ["chest"] }),
  ex("ohe", { primary: ["triceps"] }),
  ex("pushdown", { primary: ["triceps"] }),
  ex("lateral", { primary: ["side-delts"] }),
];
const pushDay = day("2026-10-09", [
  ["bench", [warm(95, 5), ...sets(185, [8, 7])]],
  ["incline", sets(65, [10, 9])],
  ["fly", sets(40, [12, 12])],
  ["ohe", sets(50, [12, 11])],
  ["pushdown", sets(60, [12, 12])],
  ["lateral", sets(20, [15, 14])],
]);

describe("trainingDays", () => {
  it("lists dates with any logged set", () => {
    const d = doc({ exercises: push, sessions: [pushDay, day("2026-10-01", [])] });
    expect([...trainingDays(d)]).toEqual(["2026-10-09"]);
  });
  it("finds the latest day on or before today", () => {
    const d = doc({ exercises: push, sessions: [pushDay, day("2026-10-20", [["bench", sets(185, [8])]])] });
    expect(latestTrainingDay(d, "2026-10-19")).toBe("2026-10-09");
    expect(latestTrainingDay(doc({}), "2026-10-19")).toBeNull();
  });
});

describe("daySummary", () => {
  const d = doc({ exercises: push, sessions: [pushDay] });
  it("names the top 3 muscles by working sets and counts exercises", () => {
    expect(daySummary(d, "2026-10-09")).toEqual({ date: "2026-10-09", muscles: ["Chest", "Triceps", "Side delts"], exerciseCount: 6 });
  });
  it("is null for a day without training", () => {
    expect(daySummary(d, "2026-10-10")).toBeNull();
  });
});

describe("repeatQueue", () => {
  it("keeps the workout's order", () => {
    const d = doc({ exercises: push, sessions: [pushDay] });
    expect(repeatQueue(d, "2026-10-09", "2026-10-19")).toEqual({ ids: ["bench", "incline", "fly", "ohe", "pushdown", "lateral"], skipped: 0 });
  });
  it("skips archived exercises and counts them", () => {
    const d = doc({ exercises: push.map((e) => (e.id === "fly" ? { ...e, archived: true } : e)), sessions: [pushDay] });
    expect(repeatQueue(d, "2026-10-09", "2026-10-19")).toEqual({ ids: ["bench", "incline", "ohe", "pushdown", "lateral"], skipped: 1 });
  });
  it("leaves out what's already logged on the log day and lists repeated blocks once", () => {
    const twice = day("2026-10-09", [["bench", sets(185, [8])], ["fly", sets(40, [12])], ["bench", sets(185, [6])]]);
    const d = doc({ exercises: push, sessions: [twice, day("2026-10-19", [["fly", sets(40, [12])]])] });
    expect(repeatQueue(d, "2026-10-09", "2026-10-19")).toEqual({ ids: ["bench"], skipped: 0 });
  });
});
