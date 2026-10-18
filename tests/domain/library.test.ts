import { describe, it, expect } from "vitest";
import { LIBRARY, customExercise, exerciseFromLibrary, searchLibrary } from "../../src/domain/library";
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
