import type { SetEntry } from "./types";

// Epley estimated 1-rep max. Combines weight AND reps into one strength number
// so rep gains (not just heavier loads) show up as progress.
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/** Reps plus reps in reserve: what the set could have been taken to. Unrated counts as +0; 4 means "4+". */
export function effectiveReps(s: SetEntry): number {
  return s.reps + (s.rir ?? 0);
}

/** Epley on effective reps, uncapped and unrounded. Drives earning the next weight only. */
export function predictE1rm(s: SetEntry): number {
  if (s.weight <= 0) return 0;
  return s.weight * (1 + effectiveReps(s) / 30);
}

const DISPLAY_REP_CAP = 12;

/** For charts, records and test day: only sets of ≤ 12 effective reps count; if none do, reps are capped at 12. */
export function displayE1rm(sets: SetEntry[]): number {
  const work = sets.filter((s) => !s.warmup && s.weight > 0);
  if (work.length === 0) return 0;
  const qualifying = work.filter((s) => effectiveReps(s) <= DISPLAY_REP_CAP);
  const pool = qualifying.length ? qualifying : work;
  return Math.round(Math.max(...pool.map((s) => s.weight * (1 + Math.min(effectiveReps(s), DISPLAY_REP_CAP) / 30))));
}

/** Reps a lifter with estimate `e` can do at `weight` (Epley inverted, rounded down). */
export function repsAt(weight: number, e: number): number {
  if (weight <= 0) return 0;
  return Math.max(0, Math.floor(30 * (e / weight - 1) + 1e-9));
}
