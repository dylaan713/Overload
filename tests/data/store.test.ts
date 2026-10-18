import { describe, it, expect } from "vitest";
import { createLocalStorageKV, createMemoryKV } from "../../src/data/kv";
import { V2_KEY, emptyDoc, loadDoc, saveDoc } from "../../src/data/store";
import { DataError } from "../../src/data/normalize";
import { day, doc, ex, sets } from "../helpers/build";

const warn = () => {};

describe("store", () => {
  it("round-trips a document under overload.v2", async () => {
    const kv = createMemoryKV();
    expect(await loadDoc(kv, warn)).toBeNull();
    const d = doc({ exercises: [ex("bench")], sessions: [day("2026-09-02", [["bench", sets(185, [8, 8], [2, null])]])] });
    await saveDoc(kv, d);
    expect(Object.keys(kv.dump())).toEqual([V2_KEY]);
    expect(await loadDoc(kv, warn)).toEqual(d);
  });

  it("throws a DataError for a corrupt v2 document", async () => {
    await expect(loadDoc(createMemoryKV({ [V2_KEY]: "{not json" }), warn)).rejects.toBeInstanceOf(DataError);
  });

  it("saveDoc rejects when storage fails (quota) and leaves the previous doc intact", async () => {
    const inner = createMemoryKV();
    await saveDoc(inner, emptyDoc("2026-09-01"));
    const before = inner.dump()[V2_KEY];
    const failing = { get: inner.get, set: async () => { throw new Error("QuotaExceededError"); } };
    await expect(saveDoc(failing, emptyDoc("2026-09-01"))).rejects.toThrow("QuotaExceededError");
    expect(inner.dump()[V2_KEY]).toBe(before);
  });
});

describe("createLocalStorageKV", () => {
  it("returns null for missing keys and propagates write errors", async () => {
    const data = new Map<string, string>();
    const kv = createLocalStorageKV({
      getItem: (k) => data.get(k) ?? null,
      setItem: () => { throw new Error("boom"); },
    });
    expect(await kv.get("nope")).toBeNull();
    await expect(kv.set("a", "b")).rejects.toThrow("boom");
  });
});
