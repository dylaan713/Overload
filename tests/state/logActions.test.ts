import { describe, it, expect } from "vitest";
import { V2_KEY } from "../../src/data/store";
import type { SetEntry } from "../../src/domain/types";
import { createAppStore } from "../../src/state/appStore";
import { day, doc, ex, warm } from "../helpers/build";
import { failing, seedDoc, stored, type MemoryKV } from "../helpers/seed";
import type { KeyValueStore } from "../../src/data/kv";

const TODAY = "2026-10-18";
let n = 0;
const newId = () => `id-${++n}`;
const work = (weight: number, reps: number): SetEntry => ({ weight, reps, warmup: false, rir: 2 });

async function ready(kv: KeyValueStore) {
  const app = createAppStore(kv, { today: () => TODAY, newId });
  await app.getState().init();
  return app;
}

describe("set actions", () => {
  it("logSet persists; removeSet then restoreSet leaves storage exactly as after the log", async () => {
    const kv = seedDoc(doc({ exercises: [ex("a")] }));
    const app = await ready(kv);
    expect(await app.getState().logSet({ day: TODAY, exerciseId: "a", set: work(100, 8), test: false })).toBe(true);
    const afterLog = kv.dump()[V2_KEY];
    expect(stored(kv).sessions[0]!.blocks[0]!.sets).toEqual([work(100, 8)]);
    const blockId = stored(kv).sessions[0]!.blocks[0]!.id;
    const removed = await app.getState().removeSet({ day: TODAY, blockId, index: 0 });
    expect(removed).not.toBeNull();
    expect(stored(kv).sessions).toEqual([]);
    expect(await app.getState().restoreSet(removed!)).toBe(true);
    expect(kv.dump()[V2_KEY]).toBe(afterLog);
  });

  it("editSet persists", async () => {
    const kv = seedDoc(doc({ exercises: [ex("a")], sessions: [day(TODAY, [["a", [work(100, 8)]]])] }));
    const app = await ready(kv);
    expect(await app.getState().editSet({ day: TODAY, blockId: `b-${TODAY}-0`, index: 0 }, work(100, 9))).toBe(true);
    expect(stored(kv).sessions[0]!.blocks[0]!.sets[0]!.reps).toBe(9);
  });

  it("setBlockTest returns the refusal once a working set exists, and persists otherwise", async () => {
    const kv = seedDoc(doc({ exercises: [ex("a"), ex("b")], sessions: [day(TODAY, [["a", [warm(50, 5)]], ["b", [work(60, 5)]]])] }));
    const app = await ready(kv);
    expect(await app.getState().setBlockTest(TODAY, "a", true)).toBeNull();
    expect(stored(kv).sessions[0]!.blocks[0]!.test).toBe(true);
    expect(await app.getState().setBlockTest(TODAY, "b", true)).toBe("Test day is chosen before your first working set");
    expect(stored(kv).sessions[0]!.blocks[1]!.test).toBe(false);
  });

  it("decideFatigue records the decision with the store's today", async () => {
    const kv = seedDoc(doc({}));
    const app = await ready(kv);
    expect(await app.getState().decideFatigue("2026-10-12", "dismissed")).toBe(true);
    expect(stored(kv).coaching.fatigueWeeks).toEqual([{ weekStart: "2026-10-12", status: "dismissed", decidedOn: TODAY }]);
  });
});

describe("failed saves", () => {
  const seeded = (): MemoryKV => seedDoc(doc({ exercises: [ex("a")], sessions: [day(TODAY, [["a", [work(100, 8)]]])] }));

  it("a failed logSet reports, changes nothing shown", async () => {
    const app = await ready(failing(seeded()));
    const before = app.getState().doc;
    expect(await app.getState().logSet({ day: TODAY, exerciseId: "a", set: work(100, 7), test: false })).toBe(false);
    expect(app.getState().doc).toEqual(before);
    expect(app.getState().saveError).toMatch(/^Couldn't save:/);
  });

  it("a failed removeSet returns null and the set is still shown", async () => {
    const app = await ready(failing(seeded()));
    expect(await app.getState().removeSet({ day: TODAY, blockId: `b-${TODAY}-0`, index: 0 })).toBeNull();
    expect(app.getState().doc.sessions[0]!.blocks[0]!.sets).toHaveLength(1);
  });
});
