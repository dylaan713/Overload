import { describe, it, expect } from "vitest";
import { bootStore, dumpLegacyRaw, hasLegacyData } from "../../src/data/boot";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { LEGACY_KEYS } from "../../src/data/legacy";
import { DataError } from "../../src/data/normalize";
import { V2_KEY, emptyDoc, saveDoc } from "../../src/data/store";
import { todayYmd } from "../../src/domain/dates";

const legacy = () =>
  createMemoryKV({
    exercises: JSON.stringify([{ id: "e", name: "Bench", type: "compound", muscleGroup: "Chest" }]),
    sessions: JSON.stringify([{ id: "s", date: "2026-07-18", name: "Push", blocks: [] }]),
    customGroups: "[]",
    settings: JSON.stringify({ unit: "lb", increment: 5 }),
  });

// Fails loudly if anything tries to write a legacy key.
function guarded(inner: KeyValueStore): KeyValueStore {
  return {
    get: inner.get,
    set: async (key, value) => {
      if ((LEGACY_KEYS as readonly string[]).includes(key)) throw new Error(`illegal write to legacy key ${key}`);
      await inner.set(key, value);
    },
  };
}

describe("bootStore", () => {
  it("fresh install writes an empty v2 doc with one hypertrophy phase dated today", async () => {
    const kv = createMemoryKV();
    const r = await bootStore(kv);
    expect(r.kind).toBe("fresh");
    expect(r.doc.exercises).toEqual([]);
    expect(r.doc.sessions).toEqual([]);
    expect(r.doc.settings.phases).toEqual([{ id: `phase-${todayYmd()}`, style: "hypertrophy", startDate: todayYmd() }]);
    expect(JSON.parse(kv.dump()[V2_KEY]!)).toEqual(r.doc);
  });

  it("legacy keys present: starts empty, leaves legacy byte-identical, adds only overload.v2", async () => {
    const kv = legacy();
    const before = kv.dump();
    const r = await bootStore(guarded(kv));
    expect(r.kind).toBe("fresh");
    expect(r.doc.exercises).toEqual([]);
    expect(r.doc.sessions).toEqual([]);
    const after = kv.dump();
    for (const key of LEGACY_KEYS) expect(after[key]).toBe(before[key]);
    expect(Object.keys(after).sort()).toEqual([...LEGACY_KEYS, V2_KEY].sort());
  });

  it("persist:false writes nothing", async () => {
    const kv = legacy();
    const before = kv.dump();
    const r = await bootStore(kv, { persist: false });
    expect(r.kind).toBe("fresh");
    expect(kv.dump()).toEqual(before);
  });

  it("returns an existing valid v2 as kind v2 and writes nothing", async () => {
    const kv = createMemoryKV();
    const doc = emptyDoc("2026-09-01");
    await saveDoc(kv, doc);
    const snapshot = kv.dump();
    const r = await bootStore(kv);
    expect(r.kind).toBe("v2");
    expect(r.doc).toEqual(doc);
    expect(kv.dump()).toEqual(snapshot);
  });

  it("a corrupt overload.v2 throws and is never overwritten", async () => {
    const kv = legacy();
    await kv.set(V2_KEY, "{corrupt");
    await expect(bootStore(kv)).rejects.toBeInstanceOf(DataError);
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });
});

describe("legacy data helpers", () => {
  it("dumpLegacyRaw returns only legacy keys", async () => {
    const kv = createMemoryKV({ exercises: "[1]", unrelated: "x", [V2_KEY]: "{}" });
    expect(await dumpLegacyRaw(kv)).toEqual({ exercises: "[1]" });
  });

  it("hasLegacyData is true with any legacy key and false without", async () => {
    expect(await hasLegacyData(createMemoryKV({ settings: "{}" }))).toBe(true);
    expect(await hasLegacyData(createMemoryKV({ unrelated: "x", [V2_KEY]: "{}" }))).toBe(false);
  });
});
