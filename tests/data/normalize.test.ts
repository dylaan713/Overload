import { describe, it, expect } from "vitest";
import { DataError, validateDoc } from "../../src/data/normalize";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";

const ex = { id: "e1", name: "Bench", type: "compound", muscleGroup: "Chest" };
const doc = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 2, exercises: [ex], sessions: [], customGroups: [], settings: DEFAULT_SETTINGS, ...over,
});
const session = (sets: unknown[], over: Record<string, unknown> = {}) => ({
  id: "s1", date: "2026-07-18", name: "Push",
  blocks: [{ id: "b1", exerciseId: "e1", sets }], ...over,
});
const run = (raw: unknown) => {
  const warnings: string[] = [];
  const result = validateDoc(raw, (m) => warnings.push(m));
  return { result, warnings };
};

describe("validateDoc", () => {
  it("accepts a clean document unchanged", () => {
    const raw = doc({ sessions: [session([{ weight: 135, reps: 8, warmup: false }])] });
    const { result, warnings } = run(raw);
    expect(result).toMatchObject({ schemaVersion: 2, exercises: [ex], programs: [] });
    expect(result.sessions).toEqual(raw.sessions);
    expect(warnings).toEqual([]);
  });

  it("coerces numeric strings, defaults missing warmup to false, keeps unknown fields", () => {
    const { result } = run(doc({ sessions: [session([{ weight: "135", reps: "8", note: "pause" }])] }));
    expect(result.sessions[0]!.blocks[0]!.sets[0]).toEqual({ weight: 135, reps: 8, warmup: false, note: "pause" });
  });

  it("rejects NaN, non-numeric and missing weights/reps", () => {
    for (const bad of [{ weight: NaN, reps: 5 }, { weight: "abc", reps: 5 }, { weight: null, reps: 5 }, { weight: 5 }, { weight: 5, reps: Infinity }]) {
      expect(() => run(doc({ sessions: [session([bad])] }))).toThrow(DataError);
    }
  });

  it("keeps negative weights (assisted movements) with a warning instead of locking the user out", () => {
    const { result, warnings } = run(doc({ sessions: [session([{ weight: -40, reps: 8, warmup: false }])] }));
    expect(result.sessions[0]!.blocks[0]!.sets[0]).toEqual({ weight: -40, reps: 8, warmup: false });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("rejects malformed dates", () => {
    expect(() => run(doc({ sessions: [session([], { date: "07/18/2026" })] }))).toThrow(DataError);
  });

  it("keeps orphan blocks (deleted exercise) and warns", () => {
    const orphan = session([{ weight: 1, reps: 1, warmup: false }], { blocks: [{ id: "b9", exerciseId: "gone", sets: [] }] });
    const { result, warnings } = run(doc({ sessions: [orphan] }));
    expect(result.sessions[0]!.blocks).toHaveLength(1);
    expect(warnings.some((w) => w.includes("gone"))).toBe(true);
  });

  it("falls back for an invalid exercise type and warns", () => {
    const { result, warnings } = run(doc({ exercises: [{ ...ex, type: "Compound" }] }));
    expect(result.exercises[0]!.type).toBe("compound");
    expect(warnings).toHaveLength(1);
  });

  it("merges partial settings and repairs garbage numerics", () => {
    const { result, warnings } = run(doc({ settings: { unit: "kg", increment: "x", compound: { sets: 3 } } }));
    expect(result.settings.unit).toBe("kg");
    expect(result.settings.increment).toBe(DEFAULT_SETTINGS.increment);
    expect(result.settings.compound.sets).toBe(3);
    expect(result.settings.compound.repTop).toBe(8);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("requires schemaVersion 2 and arrays", () => {
    expect(() => run(doc({ schemaVersion: 1 }))).toThrow(DataError);
    expect(() => run(doc({ exercises: "nope" }))).toThrow(DataError);
    expect(() => run(null)).toThrow(DataError);
  });
});
