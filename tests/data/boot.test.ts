import { describe, it, expect } from "vitest";
import { bootStore, dumpLegacyRaw } from "../../src/data/boot";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { LEGACY_KEYS } from "../../src/data/migrate";
import { DataError } from "../../src/data/normalize";
import { V2_KEY } from "../../src/data/store";
import { mergeSettings } from "../../src/domain/settings";
import { loadBackups, type BackupV1 } from "../helpers/fixtures";

const seed = (b: BackupV1) =>
  createMemoryKV({
    exercises: JSON.stringify(b.exercises),
    sessions: JSON.stringify(b.sessions),
    customGroups: JSON.stringify(b.customGroups),
    settings: JSON.stringify(b.settings),
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

describe.each(loadBackups())("migration: $name", ({ backup }) => {
  it("migrates losslessly, writes only overload.v2, and leaves legacy keys byte-identical", async () => {
    const kv = seed(backup);
    const before = kv.dump();
    const result = await bootStore(guarded(kv));
    expect(result.kind).toBe("migrated");
    expect(result.doc.exercises).toEqual(backup.exercises);
    expect(result.doc.sessions).toEqual(backup.sessions);
    expect(result.doc.customGroups).toEqual(backup.customGroups);
    expect(result.doc.settings).toEqual(mergeSettings(backup.settings));
    const after = kv.dump();
    for (const key of LEGACY_KEYS) expect(after[key]).toBe(before[key]);
    expect(Object.keys(after).sort()).toEqual([...LEGACY_KEYS, V2_KEY].sort());
  });

  it("is idempotent: the second boot reads v2 and changes nothing", async () => {
    const kv = seed(backup);
    const first = await bootStore(kv);
    const snapshot = kv.dump();
    const second = await bootStore(kv);
    expect(second.kind).toBe("v2");
    expect(second.doc).toEqual(first.doc);
    expect(kv.dump()).toEqual(snapshot);
  });

  it("dry run (persist:false) reports a migration but writes nothing", async () => {
    const kv = seed(backup);
    const before = kv.dump();
    const result = await bootStore(kv, { persist: false });
    expect(result.kind).toBe("migrated");
    expect(result.doc.sessions).toEqual(backup.sessions);
    expect(kv.dump()).toEqual(before);
  });
});

describe("boot edge cases", () => {
  it("fresh install: writes an empty v2 doc", async () => {
    const kv = createMemoryKV();
    const r = await bootStore(kv);
    expect(r.kind).toBe("fresh");
    expect(r.doc.exercises).toEqual([]);
    expect(kv.dump()[V2_KEY]).toBeDefined();
  });

  it("partial legacy data (only exercises) gets defaults for the rest", async () => {
    const kv = createMemoryKV({ exercises: JSON.stringify([{ id: "e", name: "E", type: "compound", muscleGroup: "Chest" }]) });
    const r = await bootStore(kv);
    expect(r.doc.exercises).toHaveLength(1);
    expect(r.doc.sessions).toEqual([]);
    expect(r.doc.settings.unit).toBe("lb");
  });

  it("a corrupt overload.v2 throws and does NOT fall back to re-migrating legacy", async () => {
    const b = loadBackups()[0]!.backup;
    const kv = seed(b);
    await kv.set(V2_KEY, "{corrupt");
    await expect(bootStore(kv)).rejects.toBeInstanceOf(DataError);
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });

  it("corrupt legacy JSON throws naming the key and writes nothing", async () => {
    const kv = createMemoryKV({ exercises: "[]", sessions: "{nope" });
    await expect(bootStore(kv)).rejects.toThrow(/sessions/);
    expect(kv.dump()[V2_KEY]).toBeUndefined();
  });

  it("dumpLegacyRaw returns the raw legacy strings for the error-screen export", async () => {
    const kv = createMemoryKV({ exercises: "[1]", unrelated: "x" });
    expect(await dumpLegacyRaw(kv)).toEqual({ exercises: "[1]" });
  });
});
