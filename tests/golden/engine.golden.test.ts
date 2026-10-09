import { describe, it, expect } from "vitest";
import { loadBackups } from "../helpers/fixtures";
import { entriesByExercise } from "../../src/domain/entries";
import { getSuggestion } from "../../src/domain/progression";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Settings } from "../../src/domain/types";
import * as ref from "../reference/legacyEngine.js";

const VARIANTS: Settings[] = [
  DEFAULT_SETTINGS,
  {
    ...DEFAULT_SETTINGS, unit: "kg", increment: 2.5,
    compound: { sets: 3, repBottom: 5, repTop: 5, warmupSets: 3 },
    isolation: { sets: 1, repBottom: 10, repTop: 15, warmupSets: 0 },
  },
];

describe.each(loadBackups())("golden: $name", ({ backup }) => {
  it("new getSuggestion equals the legacy engine at every point in every exercise's history", () => {
    const map = entriesByExercise(backup.exercises, backup.sessions);
    const statuses = new Set<string>();
    let comparisons = 0;
    for (const settings of VARIANTS) {
      for (const exercise of backup.exercises) {
        const desc = map[exercise.id] ?? [];
        // slice(k) = the world as it looked right after the k-th most recent session
        for (let k = 0; k <= desc.length; k++) {
          const history = desc.slice(k);
          const next = getSuggestion(exercise, history, settings);
          expect(next).toEqual(ref.getSuggestion(exercise, history, settings));
          statuses.add(next.status);
          comparisons++;
        }
      }
    }
    expect(comparisons).toBeGreaterThan(0);
    if (backup.exercises[0]?.id === "ex-stall") {
      // synthetic fixture must hit every branch, or the golden test proves too little
      expect([...statuses].sort()).toEqual(["add-reps", "decrease", "increase", "no-data", "no-working-sets", "stall"]);
    }
  });
});
