import { describe, it, expect } from "vitest";
import { getSuggestion, getSuggestedTargetWeight } from "../../src/domain/progression";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Entry, Exercise, Settings } from "../../src/domain/types";

const ex: Exercise = { id: "x", name: "X", type: "compound", muscleGroup: "Chest" };
// newest-first entries; each arg is a [weight, reps] working set
const entry = (date: string, ...sets: [number, number][]): Entry => ({
  id: date, date, sessionName: "s", exerciseId: "x",
  sets: sets.map(([weight, reps]) => ({ weight, reps, warmup: false })),
});

describe("getSuggestion", () => {
  it("no history → no-data", () => {
    expect(getSuggestion(ex, [], DEFAULT_SETTINGS)).toEqual({ status: "no-data" });
  });

  it("warm-up-only latest entry → no-working-sets", () => {
    const warmOnly: Entry = { ...entry("2026-01-01"), sets: [{ weight: 45, reps: 8, warmup: true }] };
    expect(getSuggestion(ex, [warmOnly], DEFAULT_SETTINGS).status).toBe("no-working-sets");
  });

  it("hitting the top of the range on enough sets → increase by one step", () => {
    const s = getSuggestion(ex, [entry("2026-01-02", [50, 8], [50, 8])], DEFAULT_SETTINGS);
    expect(s).toMatchObject({ status: "increase", from: 50, to: 55, big: false });
  });

  it("blowout (top + 3 on every set) → double jump", () => {
    const s = getSuggestion(ex, [entry("2026-01-02", [50, 11], [50, 11])], DEFAULT_SETTINGS);
    expect(s).toMatchObject({ status: "increase", from: 50, to: 60, big: true });
  });

  it("kg uses the configured increment", () => {
    const kg: Settings = { ...DEFAULT_SETTINGS, unit: "kg", increment: 2.5 };
    const s = getSuggestion(ex, [entry("2026-01-02", [60, 8], [60, 8])], kg);
    expect(s).toMatchObject({ status: "increase", to: 62.5 });
  });

  it("below the rep floor → decrease, never below one plate step", () => {
    expect(getSuggestion(ex, [entry("2026-01-02", [100, 5], [100, 4])], DEFAULT_SETTINGS))
      .toMatchObject({ status: "decrease", from: 100, to: 95 });
    expect(getSuggestion(ex, [entry("2026-01-02", [5, 3], [5, 3])], DEFAULT_SETTINGS))
      .toMatchObject({ status: "decrease", to: 5 });
  });

  it("same top weight for 3 sessions with no rep gain → stall deload to 90%", () => {
    const hist = ["2026-01-03", "2026-01-02", "2026-01-01"].map((d) => entry(d, [100, 6], [100, 6]));
    expect(getSuggestion(ex, hist, DEFAULT_SETTINGS)).toMatchObject({ status: "stall", weight: 100, to: 90, sessions: 3 });
  });

  it("in range but not at the top → add-reps with a per-set target", () => {
    const s = getSuggestion(ex, [entry("2026-01-02", [100, 6], [100, 7])], DEFAULT_SETTINGS);
    expect(s).toMatchObject({ status: "add-reps", weight: 100, bestReps: 7, targetReps: 8, progress: 0, targetSets: [7, 7] });
  });
});

describe("getSuggestedTargetWeight", () => {
  it("returns the weight to load next for each actionable status, else null", () => {
    expect(getSuggestedTargetWeight(ex, [entry("d", [50, 8], [50, 8])], DEFAULT_SETTINGS)).toBe(55);
    expect(getSuggestedTargetWeight(ex, [entry("d", [100, 5], [100, 4])], DEFAULT_SETTINGS)).toBe(95);
    expect(getSuggestedTargetWeight(ex, [entry("d", [100, 6], [100, 7])], DEFAULT_SETTINGS)).toBe(100);
    expect(getSuggestedTargetWeight(ex, [], DEFAULT_SETTINGS)).toBeNull();
  });
});
