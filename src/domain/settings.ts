import { isValidYmd } from "./dates";
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

// Assistance load uses the bodyweight step (spec step table), not the machine's stack step.
export function loadStep(ex: Exercise, settings: Settings): number {
  return ex.step ?? settings.equipmentSteps[ex.loadKind === "assisted" ? "bodyweight" : ex.equipment];
}

// Grid helpers. The tolerance absorbs float noise (224.9999… is 225); the final round strips it from the result.
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function floorTo(w: number, step: number): number {
  if (step <= 0) return w;
  return clean(Math.floor(w / step + 1e-9) * step);
}

export function ceilTo(w: number, step: number): number {
  if (step <= 0) return w;
  return clean(Math.ceil(w / step - 1e-9) * step);
}

export function nearestTo(w: number, step: number): number {
  if (step <= 0) return w;
  return clean(Math.round(w / step) * step);
}

/** n steps harder. For assisted lifts that means less assistance. */
export function heavier(ex: Exercise, w: number, step: number, n = 1): number {
  if (ex.loadKind === "assisted") return Math.max(0, clean(ceilTo(w, step) - n * step));
  if (ex.loadKind === "bodyweight") return clean(Math.max(0, floorTo(w, step)) + n * step);
  return clean(floorTo(w, step) + n * step);
}

/** Easier. `pct` applies to external lifts only; bodyweight and assisted lifts move by steps (spec rule 10). */
export function lighter(ex: Exercise, w: number, step: number, opts: { pct?: number; steps?: number }): number {
  if (ex.loadKind === "bodyweight") return Math.max(0, floorTo(w - (opts.steps ?? 1) * step, step));
  if (ex.loadKind === "assisted") return clean(ceilTo(w, step) + (opts.steps ?? 1) * step);
  return Math.max(step, floorTo(w * (opts.pct ?? 1) - (opts.steps ?? 0) * step, step));
}

const LB_TO_KG = 0.4536;
const KG_TO_LB = 2.2046;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Converts every logged weight (rounded to 0.1), resets equipment steps and clears per-exercise overrides.
 * Each converted set remembers its logged weight, so any number of switches back and forth is lossless.
 */
export function convertUnits(doc: StoreDoc, to: Unit): { doc: StoreDoc; changedSets: number } {
  if (doc.settings.unit === to) return { doc, changedSets: 0 };
  const factor = to === "kg" ? LB_TO_KG : KG_TO_LB;
  const forward = to === "kg" ? KG_TO_LB : LB_TO_KG; // the switch that created an `orig` in unit `to`
  let changedSets = 0;
  const sessions = doc.sessions.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => ({
      ...b,
      sets: b.sets.map((set) => {
        if (set.weight === 0 && !set.orig) return set;
        changedSets++;
        // Back to the unit it was logged in: restore the exact logged weight, but only if the shown weight is
        // still that weight's conversion. An edit since the switch makes `orig` stale, and the edit wins.
        if (set.orig?.unit === to && round1(set.orig.weight * forward) === set.weight) {
          const { orig, ...rest } = set;
          return { ...rest, weight: orig.weight };
        }
        return { ...set, weight: round1(set.weight * factor), orig: { weight: set.weight, unit: doc.settings.unit } };
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

/**
 * Switch the training style from `today`. Same style: unchanged (same object). If the current phase began
 * today, change it in place, and drop it if that makes it repeat the phase before (no zero-length phases).
 */
export function startPhase(settings: Settings, style: Style, today: string): Settings {
  const current = phaseOf(settings, today);
  if (current.style === style) return settings;
  const sorted = [...settings.phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (current.startDate === today) {
    const i = sorted.findIndex((p) => p.id === current.id);
    const before = sorted[i - 1];
    const phases = before?.style === style ? sorted.filter((p) => p.id !== current.id) : sorted.map((p) => (p.id === current.id ? { ...p, style } : p));
    return { ...settings, phases };
  }
  // Ids must stay unique even after a start date was moved onto (or off) today.
  const taken = new Set(sorted.map((p) => p.id));
  let id = `phase-${today}`;
  for (let n = 2; taken.has(id); n++) id = `phase-${today}-${n}`;
  return { ...settings, phases: [...sorted, { id, style, startDate: today }] };
}

/** Move a phase's start date, keeping phases in order and nothing in the future. */
export function setPhaseStart(settings: Settings, phaseId: string, date: string, today: string): Settings | { error: string } {
  if (!isValidYmd(date)) return { error: "Enter a valid date" };
  if (date > today) return { error: "Start date can't be in the future" };
  const sorted = [...settings.phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const i = sorted.findIndex((p) => p.id === phaseId);
  if (i === -1) return { error: "Unknown phase" };
  if (i > 0 && date <= sorted[i - 1]!.startDate) return { error: "Start date must be after the previous phase starts" };
  if (i < sorted.length - 1 && date >= sorted[i + 1]!.startDate) return { error: "Start date must be before the next phase starts" };
  return { ...settings, phases: sorted.map((p) => (p.id === phaseId ? { ...p, startDate: date } : p)) };
}
