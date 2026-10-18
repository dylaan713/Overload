import type { Equipment, Settings, Style, StyleRules, Unit } from "./types";

export const STYLE_DEFAULTS: Record<Style, StyleRules> = {
  strength: {
    compound: { repLow: 3, repHigh: 6, sets: 3, rirLow: 1, rirHigh: 2, restSeconds: 180, warmupSets: 3 },
    isolation: { repLow: 6, repHigh: 10, sets: 3, rirLow: 1, rirHigh: 2, restSeconds: 120, warmupSets: 1 },
    volume: { low: 6, high: 12 },
  },
  hypertrophy: {
    compound: { repLow: 6, repHigh: 10, sets: 3, rirLow: 0, rirHigh: 2, restSeconds: 120, warmupSets: 2 },
    isolation: { repLow: 10, repHigh: 15, sets: 3, rirLow: 0, rirHigh: 2, restSeconds: 90, warmupSets: 1 },
    volume: { low: 10, high: 20 },
  },
};

// Smallest loadable jump per equipment, per unit. Band is reps-only.
export const EQUIPMENT_STEPS: Record<Unit, Record<Equipment, number>> = {
  lb: { barbell: 5, smith: 5, "ez-bar": 5, "trap-bar": 5, dumbbell: 5, machine: 10, cable: 5, kettlebell: 9, plate: 10, bodyweight: 5, band: 0 },
  kg: { barbell: 2.5, smith: 2.5, "ez-bar": 2.5, "trap-bar": 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4, plate: 5, bodyweight: 2.5, band: 0 },
};

export function defaultSettings(today: string, unit: Unit = "lb"): Settings {
  return {
    unit,
    phases: [{ id: `phase-${today}`, style: "hypertrophy", startDate: today }],
    styles: structuredClone(STYLE_DEFAULTS),
    equipmentSteps: { ...EQUIPMENT_STEPS[unit] },
    theme: "system",
  };
}
