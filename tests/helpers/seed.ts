import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import type { StoreDoc } from "../../src/domain/types";

export type MemoryKV = ReturnType<typeof createMemoryKV>;

/** A device that already runs the new app. */
export const seedDoc = (d: StoreDoc): MemoryKV => createMemoryKV({ [V2_KEY]: JSON.stringify(d) });

/** A device with only the old app's data (raw strings, old shape). */
export const seedLegacy = (
  raw: Record<string, string> = {
    exercises: JSON.stringify([{ id: "e", name: "Bench", type: "compound", muscleGroup: "Chest" }]),
    sessions: JSON.stringify([{ id: "s", date: "2026-07-18", name: "Push", blocks: [] }]),
  },
): MemoryKV => createMemoryKV(raw);

/** Reads still work; every write throws, like a full or evicted storage. */
export function failing(inner: KeyValueStore): KeyValueStore {
  return { get: inner.get, set: async () => { throw new Error("QuotaExceededError"); } };
}

export const stored = (kv: MemoryKV): StoreDoc => JSON.parse(kv.dump()[V2_KEY]!);
