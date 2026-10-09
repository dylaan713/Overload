import { describe, it, expect } from "vitest";
import { exportBackup, importBackup, parseBackup } from "../../src/data/backup";
import { createMemoryKV } from "../../src/data/kv";
import { legacyToDoc } from "../../src/data/migrate";
import { DataError } from "../../src/data/normalize";
import { V2_KEY, emptyDoc, loadDoc, saveDoc } from "../../src/data/store";
import { loadBackups } from "../helpers/fixtures";

const warn = () => {};

describe.each(loadBackups())("backup: $name", ({ backup }) => {
  it("imports a v1 backup identically to migrating its legacy keys", () => {
    const fromV1 = parseBackup(JSON.stringify(backup), warn);
    expect(fromV1).toEqual(legacyToDoc({ ...backup }, warn));
    expect(fromV1.sessions).toEqual(backup.sessions);
  });

  it("v1 → v2 export → import round-trips losslessly", () => {
    const doc = parseBackup(JSON.stringify(backup), warn);
    const text = exportBackup(doc, new Date("2026-10-09T12:00:00Z"));
    expect(JSON.parse(text)).toMatchObject({ app: "overload", version: 2, exportedAt: "2026-10-09T12:00:00.000Z" });
    expect(parseBackup(text, warn)).toEqual(doc);
  });
});

describe("parseBackup rejections", () => {
  it("rejects invalid JSON, non-Overload files and unknown versions", () => {
    expect(() => parseBackup("{nope", warn)).toThrow(DataError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }), warn)).toThrow(/Overload/);
    expect(() => parseBackup(JSON.stringify({ app: "overload", version: 3 }), warn)).toThrow(/version/);
  });

  it("treats missing v1 arrays as empty", () => {
    const doc = parseBackup(JSON.stringify({ app: "overload", version: 1 }), warn);
    expect(doc.exercises).toEqual([]);
    expect(doc.settings.unit).toBe("lb");
  });
});

describe("importBackup", () => {
  it("replaces the store on a valid file", async () => {
    const kv = createMemoryKV();
    const b = loadBackups()[0]!.backup;
    const doc = await importBackup(kv, JSON.stringify(b), warn);
    expect(await loadDoc(kv, warn)).toEqual(doc);
  });

  it("leaves the existing store untouched when the file is invalid", async () => {
    const kv = createMemoryKV();
    await saveDoc(kv, emptyDoc());
    const before = kv.dump()[V2_KEY];
    const bad = { app: "overload", version: 1, exercises: [], sessions: [{ id: "s", date: "bad", name: "", blocks: [] }] };
    await expect(importBackup(kv, JSON.stringify(bad), warn)).rejects.toBeInstanceOf(DataError);
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});
