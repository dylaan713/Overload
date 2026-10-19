import { describe, it, expect } from "vitest";
import { convertUnits } from "../../src/domain/settings";
import { attentionFor, liftSeries, metricOf, progressSummary, sessionE1rm, trendOf } from "../../src/domain/progress";
import type { SetEntry } from "../../src/domain/types";
import { day, doc, ex, sets, warm } from "../helpers/build";

const TODAY = "2026-10-19"; // window: 2026-08-25 .. 2026-10-19

const rated = (weight: number, reps: number, rir: number | null): SetEntry => ({ weight, reps, warmup: false, rir: rir as SetEntry["rir"] });

describe("sessionE1rm", () => {
  it("adds reps-left only for Moderate, Hard and All out", () => {
    expect(sessionE1rm([rated(185, 8, 0)])).toBe(234);
    expect(sessionE1rm([rated(185, 8, 1)])).toBe(241);
    expect(sessionE1rm([rated(185, 8, 2)])).toBe(247);
  });
  it("never lets an Easy or unrated set count for more than the reps done", () => {
    expect(sessionE1rm([rated(185, 8, 4)])).toBe(234);
    expect(sessionE1rm([rated(185, 8, null)])).toBe(234);
  });
  it("takes the best set of the day", () => {
    expect(sessionE1rm([rated(185, 8, 4), rated(185, 6, 1)])).toBe(234);
  });
  it("caps effective reps at 12 when no set qualifies", () => {
    expect(sessionE1rm([rated(100, 11, 2)])).toBe(140);
  });
  it("ignores warm-ups and zero-weight sets", () => {
    expect(sessionE1rm([warm(300, 5), rated(100, 10, 0)])).toBe(133);
    expect(sessionE1rm([rated(0, 10, 0)])).toBe(0);
  });
});

describe("trendOf", () => {
  it("uses ±2% for flat and +5% for up a lot", () => {
    expect(trendOf(-2.01)).toBe("down");
    expect(trendOf(-2)).toBe("flat");
    expect(trendOf(2)).toBe("flat");
    expect(trendOf(2.01)).toBe("up");
    expect(trendOf(4.99)).toBe("up");
    expect(trendOf(5)).toBe("up-a-lot");
  });
});

describe("metricOf", () => {
  it("uses reps for bands, assisted lifts and unweighted bodyweight work", () => {
    expect(metricOf(ex("b", { equipment: "band" }), sets(0, [10]))).toBe("reps");
    expect(metricOf(ex("a", { loadKind: "assisted" }), sets(40, [8]))).toBe("reps");
    expect(metricOf(ex("p", { equipment: "bodyweight", loadKind: "bodyweight" }), sets(0, [8, 8]))).toBe("reps");
  });
  it("uses reps for bodyweight work when any session was unloaded, so an unloaded day never scores 0", () => {
    expect(metricOf(ex("p", { equipment: "bodyweight", loadKind: "bodyweight" }), [...sets(0, [8]), ...sets(25, [6])])).toBe("reps");
  });
  it("uses est. 1RM for loaded work", () => {
    expect(metricOf(ex("p", { equipment: "bodyweight", loadKind: "bodyweight" }), sets(25, [6]))).toBe("e1rm");
    expect(metricOf(ex("bench"), sets(135, [8]))).toBe("e1rm");
  });
});

describe("liftSeries", () => {
  const d = doc({
    exercises: [ex("bench")],
    phases: [
      { id: "p1", style: "hypertrophy", startDate: "2026-01-01" },
      { id: "p2", style: "strength", startDate: "2026-10-01" },
    ],
    sessions: [
      day("2026-09-20", [["bench", [warm(95, 5), ...sets(135, [8, 8])]]]),
      day("2026-09-10", [["bench", sets(130, [8])]]),
      day("2026-10-05", [["bench", sets(185, [3]), true]]),
      day("2026-10-25", [["bench", sets(200, [8])]]), // future
      day("2026-08-01", [["bench", sets(100, [8])]]), // before window
    ],
  });
  const pts = liftSeries(d, "bench", "2026-08-25", TODAY);

  it("gives one point per day with working sets, oldest first, inside the window", () => {
    expect(pts.map((p) => p.date)).toEqual(["2026-09-10", "2026-09-20", "2026-10-05"]);
    expect(pts[1]!.value).toBe(171); // 135 × 8, warm-up ignored
  });
  it("includes test days and marks them", () => {
    expect(pts[2]).toMatchObject({ test: true, value: 204 });
    expect(pts[0]!.test).toBe(false);
  });
  it("marks the first point of a new phase", () => {
    expect(pts.map((p) => p.phaseStart)).toEqual([false, false, true]);
  });
  it("uses best reps for a reps metric, with reps-left only near failure", () => {
    const b = doc({
      exercises: [ex("band", { equipment: "band" })],
      sessions: [day("2026-10-01", [["band", [rated(0, 15, 4), rated(0, 12, 2)]]])],
    });
    expect(liftSeries(b, "band", "2026-08-25", TODAY)[0]!.value).toBe(15);
  });
});

describe("progressSummary", () => {
  const rising = (w: number) => sets(w, [8, 8]);
  const d = doc({
    exercises: [ex("bench"), ex("curl", { class: "isolation", primary: ["biceps"] }), ex("squat", { primary: ["quads"] }), ex("old", { archived: true }), ex("aaa")],
    sessions: [
      day("2026-09-01", [["bench", rising(135)], ["squat", sets(225, [5])], ["old", rising(50)], ["aaa", rising(100)]]),
      day("2026-09-15", [["bench", rising(135)], ["squat", sets(215, [5])], ["old", rising(50)], ["curl", sets(40, [10])], ["aaa", rising(100)]]),
      day("2026-10-01", [["bench", rising(140)], ["squat", sets(205, [5])], ["old", rising(50)], ["aaa", rising(100)]]),
      day("2026-10-15", [["bench", rising(145)], ["old", rising(50)], ["curl", sets(40, [10])], ["aaa", rising(100)]]),
    ],
  });
  const s = progressSummary(d, TODAY);

  it("counts lifts with at least 3 sessions and says how many got stronger", () => {
    expect(s.counted).toBe(3); // bench, squat, aaa
    expect(s.stronger).toBe(1); // bench
  });
  it("leaves archived lifts out and orders by sessions, then name", () => {
    expect(s.lifts.map((l) => l.exerciseId)).toEqual(["aaa", "bench", "squat", "curl"]);
  });
  it("has no change for lifts under 3 sessions", () => {
    const curl = s.lifts.find((l) => l.exerciseId === "curl")!;
    expect(curl).toMatchObject({ sessions: 2, change: null, pct: null, trend: null });
  });
  it("compares the best of the first two sessions with the best of the last two", () => {
    const bench = s.lifts.find((l) => l.exerciseId === "bench")!;
    expect(bench.change).toBe(184 - 171); // max(171,171) → max(177,184)
    expect(bench.trend).toBe("up-a-lot");
  });
  it("averages the percentage over counted lifts", () => {
    const pcts = s.lifts.filter((l) => l.pct !== null).map((l) => l.pct!);
    expect(s.avgPct).toBe(Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length));
  });
  it("is empty and NaN-free for a new account", () => {
    expect(progressSummary(doc({}), TODAY)).toEqual({ stronger: 0, counted: 0, avgPct: null, lifts: [], attention: [] });
  });
  it("reports change in the current unit after a unit switch", () => {
    const lb = progressSummary(d, TODAY).lifts.find((l) => l.exerciseId === "bench")!.change!;
    const kg = progressSummary(convertUnits(d, "kg").doc, TODAY).lifts.find((l) => l.exerciseId === "bench")!.change!;
    expect(Math.abs(kg - lb * 0.4536)).toBeLessThanOrEqual(1);
  });
});

describe("attention", () => {
  it("pairs each reason with a one-line version", () => {
    const four2 = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"];
    const shortOf = (blocks: (i: number) => [string, SetEntry[]][]) =>
      progressSummary(doc({ exercises: [ex("bench")], style: "hypertrophy", sessions: four2.map((date, i) => day(date, blocks(i))) }), TODAY).attention[0]!.short;
    expect(shortOf((i) => [["bench", sets(185 - i * 10, [8, 8], [0, 0])]])).toBe("All out and dropping: take the lighter week");
    expect(shortOf(() => [["bench", sets(135, [8, 8], [1, 1])]])).toMatch(/^Chest short on sets: [\d.]+ of 10\+ a week$/);
    expect(shortOf(() => [["bench", sets(135, Array(24).fill(8))]])).toBe("Most sets unrated: tap a difficulty");
    expect(shortOf(() => [["bench", sets(135, Array(24).fill(8), Array(24).fill(1))]])).toBe("No gain in 7 weeks: follow the Log's target");
  });
  it("explains any flat or falling lift on its own, not just the listed ones", () => {
    const d = doc({ exercises: [ex("bench")], style: "hypertrophy", sessions: ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"].map((date) => day(date, [["bench", sets(135, [8, 8], [4, 4])]])) });
    expect(attentionFor(d, TODAY, "bench")?.reason).toBe("Most sets were Easy. Take them closer to failure.");
    expect(attentionFor(d, TODAY, "nope")).toBeNull();
  });

  const four = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"];
  const build = (blocks: (i: number) => [string, SetEntry[]][], exercises = [ex("bench")]) =>
    progressSummary(doc({ exercises, style: "hypertrophy", sessions: four.map((date, i) => day(date, blocks(i))) }), TODAY).attention;

  it("is empty when every counted lift is going up", () => {
    expect(build((i) => [["bench", sets(135 + i * 10, [8, 8], [1, 1])]])).toEqual([]);
  });
  it("calls out mostly Easy sets first", () => {
    expect(build(() => [["bench", sets(135, [8, 8], [4, 4])]])).toEqual([
      { exerciseId: "bench", name: "bench", short: "Mostly Easy sets: push closer to failure", reason: "Most sets were Easy. Take them closer to failure." },
    ]);
  });
  it("calls out a drop while every set is All out", () => {
    expect(build((i) => [["bench", sets(185 - i * 10, [8, 8], [0, 0])]])[0]!.reason).toBe(
      "Every set was All out and it's dropping. Recovery is the limit; take the lighter week when the Log offers it.",
    );
  });
  it("calls out a main muscle under its weekly range", () => {
    expect(build(() => [["bench", sets(135, [8, 8], [1, 1])]])[0]!.reason).toMatch(/^Chest gets [\d.]+ of 10\+ sets a week\. Add sets\.$/);
  });
  it("averages only full weeks since the first workout, so a new account isn't told to add sets", () => {
    // First workout Sun Sep 27, then 10 chest sets in each of the 3 full weeks since (≈ 10 a week): in range.
    const sessions = [
      day("2026-09-27", [["bench", sets(135, Array(10).fill(8), Array(10).fill(1))]]),
      day("2026-10-05", [["bench", sets(135, Array(10).fill(8), Array(10).fill(1))]]),
      day("2026-10-12", [["bench", sets(135, Array(10).fill(8), Array(10).fill(1))]]),
    ];
    const out = progressSummary(doc({ exercises: [ex("bench")], style: "hypertrophy", sessions }), TODAY).attention;
    expect(out[0]!.reason).toBe("No gain in 3 weeks. The Log changes the target when a lift stalls; follow it.");
  });
  it("calls out mostly unrated sets", () => {
    // 24 sets a session keeps chest inside its weekly range, so only the missing ratings are left to call out.
    expect(build(() => [["bench", sets(135, Array(24).fill(8))]])[0]!.reason).toBe(
      "Most sets have no difficulty, so coaching can't judge them. Tap one after each set.",
    );
  });
  it("falls back to the stall sentence", () => {
    const enough = (): [string, SetEntry[]][] => [["bench", sets(135, Array(24).fill(8), Array(24).fill(1))]];
    expect(build(enough)[0]!.reason).toBe("No gain in 7 weeks. The Log changes the target when a lift stalls; follow it.");
  });
  it("lists at most 2, drops before flats, then by percentage", () => {
    const names = ["a", "b", "c", "d"];
    const exs = names.map((n) => ex(n));
    const out = build((i) => [
      ["a", sets(135, [8], [1])],
      ["b", sets(200 - i * 20, [8], [1])],
      ["c", sets(200 - i * 5, [8], [1])],
      ["d", sets(135, [8], [1])],
    ], exs);
    expect(out.map((x) => x.exerciseId)).toEqual(["b", "c"]);
  });
});

describe("review fixes", () => {
  const b = ex("bench");
  it("doesn't judge a brand-new account's first week", () => {
    const d = doc({ exercises: [b], sessions: ["2026-10-12", "2026-10-14", "2026-10-16"].map((date) => day(date, [["bench", sets(135, [8], [1])]])) });
    const s = progressSummary(d, TODAY);
    expect(s).toMatchObject({ counted: 0, stronger: 0, attention: [] });
    expect(s.lifts[0]).toMatchObject({ sessions: 3, trend: null, change: null });
  });
  it("compares first with last when there are only 3 sessions", () => {
    const d = doc({ exercises: [b], sessions: [["2026-09-20", 150], ["2026-10-01", 153], ["2026-10-12", 156]].map(([date, w]) => day(date as string, [["bench", sets(w as number, [8], [1])]])) });
    const l = progressSummary(d, TODAY).lifts[0]!;
    expect(l.change).toBe(sessionE1rm(sets(156, [8], [1])) - sessionE1rm(sets(150, [8], [1])));
    expect(l.trend).toBe("up");
  });
  it("never reads unloaded bodyweight sessions as a drop to zero", () => {
    const dip = ex("dip", { equipment: "bodyweight", loadKind: "bodyweight" });
    const d = doc({ exercises: [dip], sessions: [day("2026-09-01", [["dip", sets(25, [8], [1])]]), day("2026-09-15", [["dip", sets(25, [8], [1])]]), day("2026-10-01", [["dip", sets(0, [12], [1])]]), day("2026-10-15", [["dip", sets(0, [12], [1])]])] });
    const l = progressSummary(d, TODAY).lifts[0]!;
    expect(l.metric).toBe("reps");
    expect(l.trend).not.toBe("down");
  });
  it("leaves assisted lifts out of the headline and attention", () => {
    const pull = ex("pull", { equipment: "machine", loadKind: "assisted" });
    const d = doc({ exercises: [pull], sessions: [["2026-09-01", 50, 10], ["2026-09-15", 45, 9], ["2026-10-01", 40, 8], ["2026-10-15", 30, 7]].map(([date, w, r]) => day(date as string, [["pull", sets(w as number, [r as number], [0])]])) });
    const s = progressSummary(d, TODAY);
    expect(s).toMatchObject({ counted: 0, attention: [] });
    expect(s.lifts[0]).toMatchObject({ counts: false, trend: null });
  });
  it("averages est. 1RM only over loaded barbell-style lifts", () => {
    const dip = ex("dip", { equipment: "bodyweight", loadKind: "bodyweight" });
    const four = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"];
    const d = doc({ exercises: [b, dip], sessions: four.map((date, i) => day(date, [["bench", sets(i < 2 ? 150 : 160, [8], [1])], ["dip", sets(i < 2 ? 10 : 25, [8], [1])]])) });
    const s = progressSummary(d, TODAY);
    const bench = s.lifts.find((l) => l.exerciseId === "bench")!;
    expect(s.counted).toBe(2);
    expect(s.avgPct).toBe(Math.round(bench.pct!));
  });
  it("only blames All out on lifts measured by est. 1RM", () => {
    const band = ex("band", { equipment: "band" });
    const d = doc({ exercises: [band], sessions: ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15"].map((date, i) => day(date, [["band", sets(0, Array(12).fill(20 - i * 3), Array(12).fill(0))]])) });
    expect(progressSummary(d, TODAY).attention[0]!.short).not.toMatch(/All out/);
  });
  it("lets the caller fix the metric for a series", () => {
    const dip = ex("dip", { equipment: "bodyweight", loadKind: "bodyweight" });
    const d = doc({ exercises: [dip], sessions: [day("2026-10-15", [["dip", sets(25, [8])]])] });
    expect(liftSeries(d, "dip", "2026-08-25", TODAY, "reps")[0]!.value).toBe(8);
  });
});
