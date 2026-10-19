import { describe, it, expect } from "vitest";
import { LIBRARY, customExercise, equipmentLabel, exerciseError, exerciseFromLibrary, groupByMovement, searchLibrary } from "../../src/domain/library";
import { MUSCLE_LABEL, REGION_OF } from "../../src/domain/library/muscles";
import { EQUIPMENT, MUSCLES } from "../../src/domain/types";

const byId = (id: string) => LIBRARY.find((e) => e.id === id);

describe("library integrity", () => {
  it("has at least 150 entries with unique ids", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(150);
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
  });

  it("every entry is well-formed", () => {
    for (const e of LIBRARY) {
      expect(e.primary.length, e.id).toBeGreaterThanOrEqual(1);
      for (const m of [...e.primary, ...e.secondary]) expect(MUSCLES, e.id).toContain(m);
      expect(EQUIPMENT, e.id).toContain(e.equipment);
      expect(["compound", "isolation"], e.id).toContain(e.class);
      expect(["external", "bodyweight", "assisted"], e.id).toContain(e.loadKind);
      expect(e.name, e.id).toMatch(/^[A-Z].* \(.+\)$/);
      expect(e.id).toMatch(/^[a-z0-9-]+\.[a-z-]+$/);
    }
  });

  it("covers the owner's examples", () => {
    const ids = [
      "bench-press.barbell", "bench-press.dumbbell", "bench-press.machine", "bench-press.smith",
      "incline-bench-press.barbell", "incline-bench-press.dumbbell", "incline-bench-press.machine", "incline-bench-press.smith",
      "curl.barbell", "curl.ez-bar", "curl.dumbbell", "curl.cable", "curl.machine",
      "lateral-raise.dumbbell", "lateral-raise.cable", "lateral-raise.machine",
    ];
    for (const id of ids) expect(byId(id), id).toBeDefined();
  });

  it("pins a few muscle maps", () => {
    const bench = byId("bench-press.barbell")!;
    expect(bench.primary).toEqual(["chest"]);
    expect(bench.secondary).toEqual(expect.arrayContaining(["front-delts", "triceps"]));
    expect(bench.class).toBe("compound");
    const raise = byId("lateral-raise.dumbbell")!;
    expect(raise.primary).toEqual(["side-delts"]);
    expect(raise.class).toBe("isolation");
    const pullup = byId("pull-up.bodyweight")!;
    expect(pullup.loadKind).toBe("bodyweight");
    expect(pullup.primary).toEqual(expect.arrayContaining(["lats"]));
    expect(byId("pull-up.machine")!.loadKind).toBe("assisted");
  });

  it("labels and regions cover every muscle", () => {
    expect(MUSCLE_LABEL["front-delts"]).toBe("Front delts");
    expect(MUSCLE_LABEL.chest).toBe("Chest");
    expect(REGION_OF.traps).toBe("Back");
    expect(REGION_OF.obliques).toBe("Core");
    for (const m of MUSCLES) expect(REGION_OF[m]).toBeDefined();
  });
});

describe("searchLibrary", () => {
  it("matches aliases, tokens in any case, and returns everything for an empty query", () => {
    expect(searchLibrary("db bench").map((e) => e.id)).toContain("bench-press.dumbbell");
    const ez = searchLibrary("CURL ez");
    expect(ez.map((e) => e.id)).toContain("curl.ez-bar");
    expect(ez.every((e) => e.equipment === "ez-bar" && /curl/i.test(e.movement))).toBe(true);
    expect(searchLibrary("")).toHaveLength(LIBRARY.length);
  });

  it("finds exercises by the muscle they mainly work, singular or plural", () => {
    for (const q of ["biceps", "bicep", "Bicep"]) {
      const movements = new Set(searchLibrary(q).map((e) => e.movement));
      for (const m of ["Curl", "Hammer curl", "Bayesian curl", "Preacher curl"]) expect(movements).toContain(m);
      expect(searchLibrary(q).every((e) => e.primary.includes("biceps"))).toBe(true);
    }
  });

  it("understands common gym words for muscles", () => {
    const works = (q: string, m: string) => {
      const r = searchLibrary(q);
      expect(r.length).toBeGreaterThan(0);
      expect(r.every((e) => e.primary.some((p) => p === m || REGION_OF[p] === m))).toBe(true);
    };
    works("pecs", "chest");
    works("lats", "lats");
    works("quads", "quads");
    works("hams", "hamstrings");
    works("calf", "calves");
    works("delts", "Shoulders");
    works("arms", "Arms");
    works("legs", "Legs");
  });

  it("needs every word to match, so muscles narrow a name and vice versa", () => {
    expect(searchLibrary("rear delt").every((e) => e.primary.includes("rear-delts"))).toBe(true);
    expect(searchLibrary("biceps cable").map((e) => e.id)).toContain("bayesian-curl.cable");
    expect(searchLibrary("biceps cable").every((e) => e.equipment === "cable")).toBe(true);
    expect(searchLibrary("front squat").every((e) => /front squat/i.test(e.name))).toBe(true);
  });

  it("doesn't treat one or two letters as a muscle", () => {
    expect(searchLibrary("ca").every((e) => /ca/i.test([e.name, e.movement, ...e.aliases].join(" ")))).toBe(true);
  });

  it("sorts by movement, then name", () => {
    const r = searchLibrary("press");
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1]!, b = r[i]!;
      expect(a.movement.localeCompare(b.movement) || a.name.localeCompare(b.name)).toBeLessThanOrEqual(0);
    }
  });
});

describe("adding exercises", () => {
  it("copies library fields", () => {
    const entry = byId("lateral-raise.dumbbell")!;
    expect(exerciseFromLibrary(entry, "x")).toEqual({
      id: "x", libraryId: "lateral-raise.dumbbell", name: entry.name, equipment: "dumbbell", primary: ["side-delts"],
      secondary: entry.secondary, class: "isolation", loadKind: "external", step: null, archived: false,
    });
  });

  it("builds a custom exercise and validates it", () => {
    expect(customExercise({ name: "  Landmine press ", equipment: "barbell", primary: ["front-delts", "chest"], secondary: ["chest", "triceps"], class: "compound" }, "x"))
      .toEqual({ id: "x", libraryId: null, name: "Landmine press", equipment: "barbell", primary: ["front-delts", "chest"], secondary: ["triceps"],
                 class: "compound", loadKind: "external", step: null, archived: false });
    expect(customExercise({ name: "Ring dip", equipment: "bodyweight", primary: ["chest"], class: "compound" }, "y"))
      .toMatchObject({ loadKind: "bodyweight" });
    expect(customExercise({ name: " ", equipment: "cable", primary: ["chest"], class: "isolation" }, "x")).toEqual({ error: "Name can't be empty" });
    expect(customExercise({ name: "Thing", equipment: "cable", primary: [], class: "isolation" }, "x")).toEqual({ error: "Pick at least one muscle worked" });
    expect(customExercise({ name: "Thing", equipment: "cable", primary: ["abs"], class: "isolation", step: 0 }, "x")).toEqual({ error: "Step must be more than 0" });
  });
});

describe("library helpers for the UI", () => {
  it("exerciseError shares customExercise's messages", () => {
    expect(exerciseError({ name: " ", primary: ["chest"] })).toBe("Name can't be empty");
    expect(exerciseError({ name: "x", primary: [] })).toBe("Pick at least one muscle worked");
    expect(exerciseError({ name: "x", primary: ["chest"], step: 0 })).toBe("Step must be more than 0");
    expect(exerciseError({ name: "x", primary: ["chest"] })).toBeNull();
  });

  it("labels equipment for display", () => {
    expect(equipmentLabel("smith")).toBe("Smith machine");
    expect(equipmentLabel("ez-bar")).toBe("EZ bar");
    expect(equipmentLabel("dumbbell")).toBe("dumbbell");
  });

  it("groups search results by movement in order of first appearance", () => {
    const groups = groupByMovement(searchLibrary("bench press"));
    const bench = groups.find((g) => g.movement === "Bench press")!;
    expect(bench.entries.map((e) => e.equipment)).toEqual(["barbell", "dumbbell", "machine", "smith"]);
    expect(groups.map((g) => g.movement)).toEqual([...new Set(searchLibrary("bench press").map((e) => e.movement))]);
  });
});

