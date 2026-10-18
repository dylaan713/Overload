import { describe, it, expect } from "vitest";
import { DataError, validateDoc } from "../../src/data/normalize";
import { day, doc, ex, sets, warm } from "../helpers/build";

const run = (raw: unknown) => {
  const warnings: string[] = [];
  const result = validateDoc(raw, (m) => warnings.push(m));
  return { result, warnings };
};
const valid = () =>
  doc({
    exercises: [ex("bench"), ex("raise", { equipment: "dumbbell", primary: ["side-delts"], class: "isolation", step: 2.5 })],
    sessions: [day("2026-09-02", [["bench", [warm(95, 8), ...sets(185, [8, 7], [2, 1])]], ["raise", sets(15, [12], [null]), true]])],
  });
// Deep-copied raw doc with one path mutated (raw JSON, so loosely typed on purpose).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutate = (fn: (d: Record<string, any>) => void) => {
  const d = JSON.parse(JSON.stringify(valid()));
  fn(d);
  return d;
};
const throwsAt = (raw: unknown, path: string) => {
  expect(() => run(raw)).toThrow(DataError);
  expect(() => run(raw)).toThrow(path);
};

describe("validateDoc", () => {
  it("accepts a valid doc unchanged and round-trips it", () => {
    const d = valid();
    const { result, warnings } = run(JSON.parse(JSON.stringify(d)));
    expect(result).toEqual(d);
    expect(warnings).toEqual([]);
    expect(run(JSON.parse(JSON.stringify(result))).result).toEqual(d);
  });

  it("rejects bad library fields, naming the path", () => {
    throwsAt(mutate((d) => (d.exercises[1].equipment = "rope")), "exercises[1].equipment");
    throwsAt(mutate((d) => (d.exercises[0].primary = ["pecs"])), "exercises[0].primary[0]");
    throwsAt(mutate((d) => (d.exercises[0].primary = [])), "exercises[0].primary");
    throwsAt(mutate((d) => (d.exercises[0].step = 0)), "exercises[0].step");
  });

  it("rejects rir outside 0–4 integers", () => {
    throwsAt(mutate((d) => (d.sessions[0].blocks[0].sets[1].rir = 5)), "sessions[0].blocks[0].sets[1].rir");
    throwsAt(mutate((d) => (d.sessions[0].blocks[0].sets[1].rir = 1.5)), "sessions[0].blocks[0].sets[1].rir");
  });

  it("fills defaults for rir, test and archived", () => {
    const { result } = run(
      mutate((d) => {
        delete d.sessions[0].blocks[0].sets[1].rir;
        delete d.sessions[0].blocks[0].test;
        delete d.exercises[0].archived;
      }),
    );
    expect(result.sessions[0]!.blocks[0]!.sets[1]!.rir).toBeNull();
    expect(result.sessions[0]!.blocks[0]!.test).toBe(false);
    expect(result.exercises[0]!.archived).toBe(false);
  });

  it("maps an unknown theme to system without a warning", () => {
    const { result, warnings } = run(mutate((d) => (d.settings.theme = "ember")));
    expect(result.settings.theme).toBe("system");
    expect(warnings).toEqual([]);
  });

  it("replaces empty phases with one hypertrophy phase at the earliest session date, with a warning", () => {
    const { result, warnings } = run(mutate((d) => (d.settings.phases = [])));
    expect(result.settings.phases).toEqual([{ id: "phase-2026-09-02", style: "hypertrophy", startDate: "2026-09-02" }]);
    expect(warnings.length).toBe(1);
  });

  it("defaults a non-numeric style field with a warning", () => {
    const { result, warnings } = run(mutate((d) => (d.settings.styles.strength.compound.repLow = "x")));
    expect(result.settings.styles.strength.compound.repLow).toBe(3);
    expect(warnings.length).toBe(1);
  });

  it("keeps orphan blocks and warns", () => {
    const { result, warnings } = run(mutate((d) => (d.sessions[0].blocks[0].exerciseId = "gone")));
    expect(result.sessions[0]!.blocks).toHaveLength(2);
    expect(warnings.some((w) => w.includes("gone"))).toBe(true);
  });

  it("defaults coaching and requires schemaVersion 2 and arrays", () => {
    expect(run(mutate((d) => delete d.coaching)).result.coaching).toEqual({ fatigueWeeks: [] });
    expect(() => run(mutate((d) => (d.schemaVersion = 1)))).toThrow(DataError);
    expect(() => run(mutate((d) => (d.exercises = "nope")))).toThrow(DataError);
    expect(() => run(null)).toThrow(DataError);
  });

  it("rejects non-numeric weights and malformed dates", () => {
    expect(() => run(mutate((d) => (d.sessions[0].blocks[0].sets[0].weight = "abc")))).toThrow(DataError);
    expect(() => run(mutate((d) => (d.sessions[0].date = "09/02/2026")))).toThrow(DataError);
  });
});

describe("validateDoc: values the engine depends on", () => {
  it("replaces an equipment step ≤ 0 (except band) with the default, with a warning", () => {
    const { result, warnings } = run(mutate((d) => { d.settings.equipmentSteps.barbell = 0; d.settings.equipmentSteps.cable = -5; }));
    expect(result.settings.equipmentSteps.barbell).toBe(5);
    expect(result.settings.equipmentSteps.cable).toBe(5);
    expect(result.settings.equipmentSteps.band).toBe(0);
    expect(warnings.length).toBe(2);
  });

  it("repairs style rules the engine can't use", () => {
    const { result, warnings } = run(mutate((d) => {
      d.settings.styles.hypertrophy.compound.sets = 2.5;
      d.settings.styles.hypertrophy.isolation.repLow = 20; // above repHigh 15
      d.settings.styles.strength.compound.rirHigh = 7;
    }));
    expect(result.settings.styles.hypertrophy.compound.sets).toBe(3);
    expect(result.settings.styles.hypertrophy.isolation).toMatchObject({ repLow: 10, repHigh: 15 });
    expect(result.settings.styles.strength.compound.rirHigh).toBe(2);
    expect(warnings.length).toBe(3);
  });

  it("drops malformed fatigue decisions with a warning", () => {
    const good = { weekStart: "2026-10-11", status: "accepted", decidedOn: "2026-10-14" };
    const { result, warnings } = run(mutate((d) => {
      d.coaching = { fatigueWeeks: [null, good, { weekStart: "2026-10-11", status: "accepted", decidedOn: "1" }, { ...good, status: "maybe" }] };
    }));
    expect(result.coaching.fatigueWeeks).toEqual([good]);
    expect(warnings.length).toBe(3);
  });
});
