import { describe, it, expect } from "vitest";
import { exportBackup, importBackup, parseBackup } from "../../src/data/backup";
import { createMemoryKV } from "../../src/data/kv";
import { DataError } from "../../src/data/normalize";
import { V2_KEY, emptyDoc, loadDoc, saveDoc } from "../../src/data/store";
import { day, doc, ex, sets } from "../helpers/build";

const warn = () => {};
const sample = () => doc({ exercises: [ex("bench")], sessions: [day("2026-09-02", [["bench", sets(185, [8, 8], [2, 1])]])] });

describe("parseBackup", () => {
  it("round-trips a v2 export to an equal doc", () => {
    const d = sample();
    const text = exportBackup(d, new Date("2026-10-09T12:00:00Z"));
    expect(JSON.parse(text)).toMatchObject({ app: "overload", version: 2, exportedAt: "2026-10-09T12:00:00.000Z" });
    expect(parseBackup(text, warn)).toEqual(d);
  });

  it("rejects old-app (v1) files", () => {
    expect(() => parseBackup(JSON.stringify({ app: "overload", version: 1, exercises: [] }), warn)).toThrow(
      new DataError("This backup is from the old app and can't be imported"),
    );
  });

  it("rejects invalid JSON, non-Overload files and unknown versions", () => {
    expect(() => parseBackup("{nope", warn)).toThrow("Backup file is not valid JSON");
    expect(() => parseBackup(JSON.stringify({ hello: 1 }), warn)).toThrow("Not an Overload backup file");
    expect(() => parseBackup(JSON.stringify({ app: "overload", version: 3 }), warn)).toThrow(/version/);
  });
});

describe("importBackup", () => {
  it("replaces the store on a valid file", async () => {
    const kv = createMemoryKV();
    const d = await importBackup(kv, exportBackup(sample()), warn);
    expect(await loadDoc(kv, warn)).toEqual(d);
  });

  it("leaves the existing store untouched when the file is invalid", async () => {
    const kv = createMemoryKV();
    await saveDoc(kv, emptyDoc("2026-09-01"));
    const before = kv.dump()[V2_KEY];
    const bad = { app: "overload", ...sample(), version: 2, sessions: [{ id: "s", date: "bad", name: "", blocks: [] }] };
    await expect(importBackup(kv, JSON.stringify(bad), warn)).rejects.toBeInstanceOf(DataError);
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});
