import { describe, it, expect } from "vitest";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { LIBRARY } from "../../src/domain/library";
import { createAppStore } from "../../src/state/appStore";
import { day, doc, ex, sets } from "../helpers/build";
import { failing, seedDoc, seedLegacy, stored } from "../helpers/seed";

const today = () => "2026-10-17";
let n = 0;
const newId = () => `id-${++n}`;
const bench = LIBRARY.find((e) => e.id === "bench-press.dumbbell")!;

async function ready(kv: KeyValueStore) {
  const app = createAppStore(kv, { today, newId });
  await app.getState().init();
  return app;
}

describe("boot", () => {
  it("a device with only old app data starts empty, writes only overload.v2 and reports the old data", async () => {
    const kv = seedLegacy();
    const before = kv.dump();
    const app = await ready(kv);
    expect(app.getState()).toMatchObject({ status: "ready", bootKind: "fresh", hasLegacy: true });
    expect(app.getState().doc.exercises).toEqual([]);
    const after = kv.dump();
    for (const k of Object.keys(before)) expect(after[k]).toBe(before[k]);
    expect(Object.keys(after).sort()).toEqual([...Object.keys(before), V2_KEY].sort());
  });

  it("an existing v2 doc boots as v2", async () => {
    const app = await ready(seedDoc(doc({ exercises: [ex("a")] })));
    expect(app.getState()).toMatchObject({ status: "ready", bootKind: "v2", hasLegacy: false });
    expect(app.getState().doc.exercises).toHaveLength(1);
  });

  it("a corrupt v2 doc is an error and nothing is written", async () => {
    const kv = createMemoryKV({ [V2_KEY]: "{corrupt" });
    const app = await ready(kv);
    expect(app.getState().status).toBe("error");
    expect(app.getState().error).toBeTruthy();
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });

  it("init twice boots once", async () => {
    const kv = createMemoryKV();
    let gets = 0;
    const counting: KeyValueStore = { get: (k) => { gets++; return kv.get(k); }, set: kv.set };
    const app = createAppStore(counting, { today, newId });
    await Promise.all([app.getState().init(), app.getState().init()]);
    const once = gets;
    await app.getState().init();
    expect(gets).toBe(once);
  });
});

describe("units", () => {
  const withSets = () => doc({ exercises: [ex("a")], sessions: [day("2026-10-01", [["a", [...sets(225, [5]), ...sets(0, [10])]]])] });

  it("setUnit converts and stores", async () => {
    const kv = seedDoc(withSets());
    const app = await ready(kv);
    expect(await app.getState().setUnit("kg")).toBe(true);
    const s = stored(kv);
    expect(s.settings.unit).toBe("kg");
    expect(s.settings.equipmentSteps.dumbbell).toBe(2);
    expect(s.sessions[0]!.blocks[0]!.sets.map((x) => x.weight)).toEqual([102.1, 0]);
  });

  it("a failed save restores the unit and every weight", async () => {
    const app = await ready(failing(seedDoc(withSets())));
    expect(await app.getState().setUnit("kg")).toBe(false);
    const { doc: d, saveError } = app.getState();
    expect(d.settings.unit).toBe("lb");
    expect(d.sessions[0]!.blocks[0]!.sets.map((x) => x.weight)).toEqual([225, 0]);
    expect(saveError).toMatch(/^Couldn't save:/);
    app.getState().dismissSaveError();
    expect(app.getState().saveError).toBeNull();
  });
});

describe("phases", () => {
  it("startPhase persists, and switching back the same day leaves one phase", async () => {
    const kv = seedDoc(doc({ phases: [{ id: "p", style: "hypertrophy", startDate: "2026-09-01" }] }));
    const app = await ready(kv);
    await app.getState().startPhase("strength");
    expect(stored(kv).settings.phases.map((p) => p.style)).toEqual(["hypertrophy", "strength"]);
    await app.getState().startPhase("hypertrophy");
    expect(stored(kv).settings.phases).toHaveLength(1);
  });

  it("setPhaseStart returns the error and writes nothing", async () => {
    const kv = seedDoc(doc({ phases: [{ id: "p", style: "hypertrophy", startDate: "2026-09-01" }] }));
    const app = await ready(kv);
    const before = kv.dump()[V2_KEY];
    expect(await app.getState().setPhaseStart("p", "2026-11-01")).toBe("Start date can't be in the future");
    expect(kv.dump()[V2_KEY]).toBe(before);
    expect(await app.getState().setPhaseStart("p", "2026-08-01")).toBeNull();
    expect(stored(kv).settings.phases[0]!.startDate).toBe("2026-08-01");
  });
});

describe("library", () => {
  it("adding the same library entry twice never duplicates", async () => {
    const kv = seedDoc(doc({}));
    const app = await ready(kv);
    const id = await app.getState().addFromLibrary(bench);
    expect(id).toBeTruthy();
    expect(await app.getState().addFromLibrary(bench)).toBe(id);
    expect(stored(kv).exercises).toHaveLength(1);
    expect(stored(kv).exercises[0]).toMatchObject({ id, libraryId: "bench-press.dumbbell", archived: false });
  });

  it("adding an archived entry restores it with its id", async () => {
    const kv = seedDoc(doc({}));
    const app = await ready(kv);
    const id = (await app.getState().addFromLibrary(bench))!;
    await app.getState().setArchived(id, true);
    expect(stored(kv).exercises[0]!.archived).toBe(true);
    expect(await app.getState().addFromLibrary(bench)).toBe(id);
    expect(stored(kv).exercises[0]!.archived).toBe(false);
  });

  it("addCustom validates and stores", async () => {
    const kv = seedDoc(doc({}));
    const app = await ready(kv);
    const before = kv.dump()[V2_KEY];
    expect(await app.getState().addCustom({ name: " ", equipment: "cable", primary: ["chest"], class: "isolation" })).toEqual({ error: "Name can't be empty" });
    expect(kv.dump()[V2_KEY]).toBe(before);
    const r = await app.getState().addCustom({ name: "Landmine press", equipment: "barbell", primary: ["front-delts"], class: "compound" });
    expect("id" in r).toBe(true);
    expect(stored(kv).exercises[0]).toMatchObject({ name: "Landmine press", libraryId: null });
  });

  it("updateExercise persists; deleteExercise cascades", async () => {
    const kv = seedDoc(doc({ exercises: [ex("a"), ex("b")], sessions: [day("2026-10-01", [["a", sets(100, [5])]])] }));
    const app = await ready(kv);
    expect(await app.getState().updateExercise("a", { step: 2.5 })).toBe(true);
    expect(stored(kv).exercises[0]!.step).toBe(2.5);
    expect(await app.getState().deleteExercise("a")).toBe(true);
    expect(stored(kv).exercises.map((e) => e.id)).toEqual(["b"]);
    expect(stored(kv).sessions).toEqual([]);
  });

  it("a failed archive rolls back and reports the error", async () => {
    const app = await ready(failing(seedDoc(doc({ exercises: [ex("a")] }))));
    expect(await app.getState().setArchived("a", true)).toBe(false);
    expect(app.getState().doc.exercises[0]!.archived).toBe(false);
    expect(app.getState().saveError).toMatch(/^Couldn't save:/);
  });
});

describe("settings and import", () => {
  it("updateSettings and replaceDoc persist", async () => {
    const kv = seedDoc(doc({}));
    const app = await ready(kv);
    expect(await app.getState().updateSettings((s) => ({ ...s, theme: "dark" }))).toBe(true);
    expect(stored(kv).settings.theme).toBe("dark");
    const next = doc({ exercises: [ex("z")] });
    expect(await app.getState().replaceDoc(next)).toBe(true);
    expect(stored(kv).exercises.map((e) => e.id)).toEqual(["z"]);
  });
});

describe("wave 2 review: the store never loses data", () => {
  it("an action before init finishes can't wipe stored data", async () => {
    const kv = seedDoc(doc({ exercises: [ex("a"), ex("b")] }));
    const app = createAppStore(kv, { today, newId });
    const booting = app.getState().init();
    expect(await app.getState().updateSettings((s) => ({ ...s, theme: "dark" }))).toBe(false);
    await booting;
    expect(app.getState().doc.exercises).toHaveLength(2);
    expect(stored(kv).exercises).toHaveLength(2);
  });

  it("after a boot error nothing can overwrite the stored document", async () => {
    const kv = createMemoryKV({ [V2_KEY]: "{corrupt" });
    const app = await ready(kv);
    expect(await app.getState().updateSettings((s) => s)).toBe(false);
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });

  it("two overlapping failed writes leave nothing showing that wasn't saved", async () => {
    const app = await ready(failing(seedDoc(doc({ exercises: [ex("a"), ex("b")] }))));
    const [ra, rb] = await Promise.all([app.getState().setArchived("a", true), app.getState().setArchived("b", true)]);
    expect([ra, rb]).toEqual([false, false]);
    expect(app.getState().doc.exercises.map((e) => e.archived)).toEqual([false, false]);
  });

  it("when an earlier write fails and a later one succeeds, memory matches storage", async () => {
    const inner = seedDoc(doc({ exercises: [ex("a"), ex("b")] }));
    let calls = 0;
    const flaky: KeyValueStore = {
      get: inner.get,
      // A v2 doc exists, so boot writes nothing: write 1 is "archive a" (fails, late), write 2 is "archive b".
      async set(k, v) {
        const n = ++calls;
        if (n === 1) {
          await new Promise((r) => setTimeout(r, 20));
          throw new Error("disk busy");
        }
        return inner.set(k, v);
      },
    };
    const app = await ready(flaky);
    await Promise.all([app.getState().setArchived("a", true), app.getState().setArchived("b", true)]);
    const memory = app.getState().doc.exercises.map((e) => e.archived);
    expect(memory).toEqual(stored(inner).exercises.map((e) => e.archived));
    expect(memory).toEqual([false, true]); // a failed, b saved on its own
  });
});

