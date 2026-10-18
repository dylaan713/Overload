import type { ClassRules, Equipment, Exercise, Phase, Settings, StoreDoc, Style, StyleRules, Unit } from "./types";

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

/** The phase with the latest startDate ≤ date. Dates before every phase belong to the earliest one. */
export function phaseOf(settings: Settings, date: string): Phase {
  const sorted = [...settings.phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let current = sorted[0]!;
  for (const p of sorted) if (p.startDate <= date) current = p;
  return current;
}

export function rulesFor(ex: Exercise, settings: Settings, date: string): ClassRules & { volume: { low: number; high: number }; style: Style } {
  const style = phaseOf(settings, date).style;
  const rules = settings.styles[style];
  return { ...rules[ex.class], volume: { ...rules.volume }, style };
}

export function loadStep(ex: Exercise, settings: Settings): number {
  return ex.step ?? settings.equipmentSteps[ex.equipment];
}

// Grid helpers. The tolerance absorbs float noise (224.9999… is 225); the final round strips it from the result.
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function floorTo(w: number, step: number): number {
  if (step <= 0) return w;
  return clean(Math.floor(w / step + 1e-9) * step);
}

export function nearestTo(w: number, step: number): number {
  if (step <= 0) return w;
  return clean(Math.round(w / step) * step);
}

/** n steps harder. For assisted lifts that means less assistance. */
export function heavier(ex: Exercise, w: number, step: number, n = 1): number {
  if (ex.loadKind === "assisted") return Math.max(0, clean(floorTo(w, step) - n * step));
  if (ex.loadKind === "bodyweight") return clean(Math.max(0, floorTo(w, step)) + n * step);
  return clean(floorTo(w, step) + n * step);
}

/** Easier. `pct` applies to external lifts only; bodyweight and assisted lifts move by steps (spec rule 10). */
export function lighter(ex: Exercise, w: number, step: number, opts: { pct?: number; steps?: number }): number {
  if (ex.loadKind === "bodyweight") return Math.max(0, clean(w - (opts.steps ?? 1) * step));
  if (ex.loadKind === "assisted") return clean(w + (opts.steps ?? 1) * step);
  return Math.max(step, floorTo(w * (opts.pct ?? 1) - (opts.steps ?? 0) * step, step));
}

const LB_TO_KG = 0.4536;
const KG_TO_LB = 2.2046;

/** Converts every logged weight (rounded to 0.1), resets equipment steps and clears per-exercise overrides. */
export function convertUnits(doc: StoreDoc, to: Unit): { doc: StoreDoc; changedSets: number } {
  if (doc.settings.unit === to) return { doc, changedSets: 0 };
  const factor = to === "kg" ? LB_TO_KG : KG_TO_LB;
  let changedSets = 0;
  const sessions = doc.sessions.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => ({
      ...b,
      sets: b.sets.map((set) => {
        if (set.weight === 0) return set;
        changedSets++;
        return { ...set, weight: Math.round(set.weight * factor * 10) / 10 };
      }),
    })),
  }));
  return {
    doc: {
      ...doc,
      sessions,
      exercises: doc.exercises.map((e) => ({ ...e, step: null })),
      settings: { ...doc.settings, unit: to, equipmentSteps: { ...EQUIPMENT_STEPS[to] } },
    },
    changedSets,
  };
}
