import { describe, it, expect } from "vitest";
import { targetsFor } from "../../src/domain/engine/targets";
import {
  LOG_DAY_GRACE_MS, appendSet, blockFor, canTest, coachFor, logDayFor, prefill, removeBlock, removeSet, replaceSet, restoreBlock, restoreSet,
  setTestFlag, withoutDay,
} from "../../src/domain/log";
import type { SetEntry, StoreDoc } from "../../src/domain/types";
import { day, doc, ex, sets, warm } from "../helpers/build";

let n = 0;
const newId = () => `id-${++n}`;
const NOW = Date.parse("2026-10-18T00:40:00");
const work = (weight: number, reps: number, rir: SetEntry["rir"] = 2): SetEntry => ({ weight, reps, warmup: false, rir });

describe("logDayFor", () => {
  const d = doc({ exercises: [ex("a")], sessions: [day("2026-10-17", [["a", sets(100, [5])]])] });

  it("is today with nothing logged", () => {
    expect(logDayFor(d, "2026-10-18", NOW, null)).toBe("2026-10-18");
  });

  it("stays on the last session for up to 3 hours after its last set", () => {
    expect(logDayFor(d, "2026-10-18", NOW, { day: "2026-10-17", at: NOW - 70 * 60_000 })).toBe("2026-10-17");
    expect(logDayFor(d, "2026-10-18", NOW, { day: "2026-10-17", at: NOW - LOG_DAY_GRACE_MS - 60_000 })).toBe("2026-10-18");
  });

  it("moves on when that session no longer exists", () => {
    expect(logDayFor(doc({}), "2026-10-18", NOW, { day: "2026-10-17", at: NOW - 60_000 })).toBe("2026-10-18");
  });
});

describe("appendSet", () => {
  it("creates the day's session and block, then appends to them; another exercise gets its own block", () => {
    let d = doc({ exercises: [ex("a"), ex("b")] });
    d = appendSet(d, { day: "2026-10-18", exerciseId: "a", set: work(100, 8), test: true }, newId);
    d = appendSet(d, { day: "2026-10-18", exerciseId: "a", set: work(100, 7), test: false }, newId);
    d = appendSet(d, { day: "2026-10-18", exerciseId: "b", set: work(50, 10), test: false }, newId);
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0]).toMatchObject({ date: "2026-10-18", name: "" });
    expect(d.sessions[0]!.blocks.map((b) => [b.exerciseId, b.test, b.sets.length])).toEqual([["a", true, 2], ["b", false, 1]]);
  });

  it("keeps sessions sorted by date", () => {
    let d = doc({ exercises: [ex("a")], sessions: [day("2026-10-20", [["a", sets(100, [5])]])] });
    d = appendSet(d, { day: "2026-10-18", exerciseId: "a", set: work(100, 8), test: false }, newId);
    expect(d.sessions.map((s) => s.date)).toEqual(["2026-10-18", "2026-10-20"]);
  });
});

describe("replaceSet", () => {
  const withOrig = (): StoreDoc => {
    const d = doc({ exercises: [ex("a")], sessions: [day("2026-10-18", [["a", [{ ...work(102.1, 8), orig: { weight: 225, unit: "lb" } }]]])] });
    d.settings.unit = "kg";
    return d;
  };
  const ref = (d: StoreDoc) => ({ day: "2026-10-18", blockId: d.sessions[0]!.blocks[0]!.id, index: 0 });

  it("drops orig when the weight changes", () => {
    const d = withOrig();
    expect(replaceSet(d, ref(d), work(105, 8)).sessions[0]!.blocks[0]!.sets[0]).toEqual(work(105, 8));
  });

  it("keeps orig when only reps change", () => {
    const d = withOrig();
    expect(replaceSet(d, ref(d), work(102.1, 9)).sessions[0]!.blocks[0]!.sets[0]!.orig).toEqual({ weight: 225, unit: "lb" });
  });
});

describe("removeSet and restoreSet", () => {
  const base = () =>
    doc({
      exercises: [ex("a"), ex("b")],
      sessions: [
        day("2026-10-16", [["a", sets(100, [5])]]),
        day("2026-10-17", [["a", [warm(50, 8), ...sets(100, [8, 7, 6])]], ["b", sets(40, [12])]]),
        day("2026-10-18", [["a", sets(100, [5])]]),
      ],
    });

  it("round-trips a middle set exactly", () => {
    const d = base();
    const r = removeSet(d, { day: "2026-10-17", blockId: "b-2026-10-17-0", index: 2 })!;
    expect(r.doc.sessions[1]!.blocks[0]!.sets).toHaveLength(3);
    expect(restoreSet(r.doc, r.removed)).toEqual(d);
  });

  it("removes and restores a block's only set among other blocks", () => {
    const d = base();
    const r = removeSet(d, { day: "2026-10-17", blockId: "b-2026-10-17-1", index: 0 })!;
    expect(r.doc.sessions[1]!.blocks.map((b) => b.exerciseId)).toEqual(["a"]);
    expect(restoreSet(r.doc, r.removed)).toEqual(d);
  });

  it("removes and restores the day's only set: the session comes back with its id and position", () => {
    const d = base();
    const r = removeSet(d, { day: "2026-10-16", blockId: "b-2026-10-16-0", index: 0 })!;
    expect(r.doc.sessions.map((s) => s.date)).toEqual(["2026-10-17", "2026-10-18"]);
    expect(restoreSet(r.doc, r.removed)).toEqual(d);
  });

  it("restores at the original index without losing a set logged in the meantime", () => {
    const d = base();
    const r = removeSet(d, { day: "2026-10-17", blockId: "b-2026-10-17-0", index: 1 })!;
    const later = appendSet(r.doc, { day: "2026-10-17", exerciseId: "a", set: work(100, 5), test: false }, newId);
    const sets17 = restoreSet(later, r.removed).sessions[1]!.blocks[0]!.sets.map((s) => s.reps);
    expect(sets17).toEqual([8, 8, 7, 6, 5]);
  });

  it("Undo after the day was emptied and the same exercise logged again merges into that block (wave 1 review)", () => {
    let d = doc({ exercises: [ex("a")] });
    d = appendSet(d, { day: "2026-10-18", exerciseId: "a", set: work(100, 8), test: false }, newId);
    const r = removeSet(d, { day: "2026-10-18", blockId: d.sessions[0]!.blocks[0]!.id, index: 0 })!;
    const again = appendSet(r.doc, { day: "2026-10-18", exerciseId: "a", set: work(100, 6), test: false }, newId);
    const restored = restoreSet(again, r.removed);
    expect(restored.sessions).toHaveLength(1);
    expect(restored.sessions[0]!.blocks).toHaveLength(1);
    expect(restored.sessions[0]!.blocks[0]!.sets.map((s) => s.reps)).toEqual([8, 6]);
  });

  it("returns null for a set that isn't there", () => {
    expect(removeSet(base(), { day: "2026-10-17", blockId: "nope", index: 0 })).toBeNull();
  });
});

describe("test day", () => {
  it("can be set while only warm-ups are logged, not after a working set", () => {
    const d = doc({ exercises: [ex("a")], sessions: [day("2026-10-18", [["a", [warm(60, 5)]]])] });
    const on = setTestFlag(d, "2026-10-18", "a", true);
    expect("error" in on).toBe(false);
    expect(blockFor(on as StoreDoc, "2026-10-18", "a")!.test).toBe(true);
    const worked = appendSet(d, { day: "2026-10-18", exerciseId: "a", set: work(100, 5), test: false }, newId);
    expect(setTestFlag(worked, "2026-10-18", "a", true)).toEqual({ error: "Test day is chosen before your first working set" });
  });

  it("is offered only for external, non-band loads", () => {
    expect(canTest(ex("a"))).toBe(true);
    expect(canTest(ex("b", { loadKind: "bodyweight", equipment: "bodyweight" }))).toBe(false);
    expect(canTest(ex("c", { equipment: "band" }))).toBe(false);
  });
});

describe("coachFor", () => {
  it("ignores the Log's own day: targets and last time come from earlier sessions", () => {
    const d = doc({
      exercises: [ex("a")],
      sessions: [day("2026-10-10", [["a", sets(100, [10, 10, 10])]]), day("2026-10-18", [["a", sets(100, [6])]])],
    });
    const c = coachFor(d, "a", "2026-10-18", false);
    expect(c.targets).toEqual(targetsFor("a", withoutDay(d, "2026-10-18"), "2026-10-18"));
    expect(c.last?.date).toBe("2026-10-10");
  });
});

describe("prefill", () => {
  const d = doc({ exercises: [ex("a")], sessions: [day("2026-10-10", [["a", sets(100, [10, 10, 10])]])] });
  const t = coachFor(d, "a", "2026-10-18", false).targets;

  it("walks the warm-up ramp, then repeats the last logged warm-up", () => {
    expect(t.warmups.length).toBeGreaterThan(0);
    expect(prefill(t, undefined, true)).toEqual(t.warmups[0]);
    const block = { id: "b", exerciseId: "a", test: false, sets: t.warmups.map((w) => warm(w.weight, w.reps)) };
    expect(prefill(t, block, true)).toEqual(t.warmups.at(-1));
  });

  it("walks the target sets, then repeats the last", () => {
    expect(prefill(t, undefined, false)).toEqual({ weight: t.weight, reps: t.sets[0]!.reps });
    const block = { id: "b", exerciseId: "a", test: false, sets: [work(1, 1), work(1, 1), work(1, 1), work(1, 1)] };
    expect(prefill(t, block, false)).toEqual({ weight: t.weight, reps: t.sets.at(-1)!.reps });
  });

  it("first time: no weight until one is logged, then the last logged working weight", () => {
    const first = coachFor(doc({ exercises: [ex("a")] }), "a", "2026-10-18", false).targets;
    expect(first.weight).toBeNull();
    expect(prefill(first, undefined, false).weight).toBeNull();
    const block = { id: "b", exerciseId: "a", test: false, sets: [work(80, 10)] };
    expect(prefill(first, block, false).weight).toBe(80);
  });

  it("test day: ladder weights for singles", () => {
    const tt = coachFor(d, "a", "2026-10-18", true).targets;
    expect(tt.ladder!.length).toBeGreaterThan(1);
    expect(prefill(tt, undefined, false)).toEqual({ weight: tt.ladder![0], reps: 1 });
    const block = { id: "b", exerciseId: "a", test: true, sets: [work(tt.ladder![0]!, 1)] };
    expect(prefill(tt, block, false)).toEqual({ weight: tt.ladder![1], reps: 1 });
  });
});

describe("removeBlock / restoreBlock", () => {
  const base = () =>
    doc({
      exercises: [ex("a"), ex("b")],
      sessions: [day("2026-10-17", [["a", sets(100, [5])]]), day("2026-10-18", [["a", [warm(45, 8), ...sets(100, [5, 5])]], ["b", sets(30, [12])]])],
    });

  it("removes an exercise and all its sets, leaving the rest of the day alone", () => {
    const r = removeBlock(base(), "2026-10-18", "b-2026-10-18-0")!;
    expect(r.removed.block.sets).toHaveLength(3);
    const blocks = r.doc.sessions.find((s) => s.date === "2026-10-18")!.blocks;
    expect(blocks.map((b) => b.exerciseId)).toEqual(["b"]);
    expect(r.doc.sessions.find((s) => s.date === "2026-10-17")!.blocks).toHaveLength(1);
  });

  it("puts it back where it was, sets and all", () => {
    const d = base();
    const r = removeBlock(d, "2026-10-18", "b-2026-10-18-0")!;
    expect(restoreBlock(r.doc, r.removed)).toEqual(d);
  });

  it("the day's last exercise takes the session with it, and Undo rebuilds it with the same id", () => {
    const d = base();
    const r = removeBlock(d, "2026-10-17", "b-2026-10-17-0")!;
    expect(r.doc.sessions.map((s) => s.date)).toEqual(["2026-10-18"]);
    const back = restoreBlock(r.doc, r.removed);
    expect(back.sessions.map((s) => s.date)).toEqual(["2026-10-17", "2026-10-18"]);
    expect(back.sessions[0]!.id).toBe("s-2026-10-17");
    expect(back).toEqual(d);
  });

  it("never leaves two blocks for one exercise: sets logged since keep theirs, the restored ones go on top", () => {
    const r = removeBlock(base(), "2026-10-18", "b-2026-10-18-0")!;
    const again = appendSet(r.doc, { day: "2026-10-18", exerciseId: "a", set: work(105, 5), test: false }, newId);
    const back = restoreBlock(again, r.removed);
    const blocks = back.sessions.find((s) => s.date === "2026-10-18")!.blocks;
    expect(blocks.filter((b) => b.exerciseId === "a")).toHaveLength(1);
    expect(blocks.find((b) => b.exerciseId === "a")!.sets.map((s) => s.weight)).toEqual([45, 100, 100, 105]);
  });

  it("is nothing to do for a day or a block that isn't there", () => {
    expect(removeBlock(base(), "2026-10-18", "nope")).toBeNull();
    expect(removeBlock(base(), "2026-10-20", "b-2026-10-18-0")).toBeNull();
  });
});
