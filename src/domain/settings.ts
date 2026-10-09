import type { Settings, Unit } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  unit: "lb",
  increment: 5, // amount added on an increase, in the current unit
  compound: { sets: 2, repBottom: 6, repTop: 8, warmupSets: 2 },
  isolation: { sets: 2, repBottom: 8, repTop: 10, warmupSets: 1 },
  restTimer: { defaultSeconds: 120 },
  theme: "ember",
};

// Merge stored settings over defaults so older/partial saves don't break.
export function mergeSettings(stored: unknown): Settings {
  if (!stored || typeof stored !== "object") return structuredClone(DEFAULT_SETTINGS);
  const s = stored as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    compound: { ...DEFAULT_SETTINGS.compound, ...(s.compound || {}) },
    isolation: { ...DEFAULT_SETTINGS.isolation, ...(s.isolation || {}) },
    restTimer: { ...DEFAULT_SETTINGS.restTimer, ...(s.restTimer || {}) },
  };
}

export function plateIncrement(unit: Unit): number {
  return unit === "kg" ? 2.5 : 5;
}
