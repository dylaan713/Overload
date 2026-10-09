import type { Entry, Exercise, ExerciseType, SetEntry, Settings } from "./types";
import { plateIncrement } from "./settings";

// Coaching tuning (identical to the pre-rewrite engine).
export const STALL_SESSIONS = 3; // same top weight, no rep gain, this many sessions → deload
export const BLOWOUT_MARGIN = 3; // reps past the top of the range that earn a double jump
export const DELOAD_PCT = 0.9; // deload target = 90% of the stalled weight

export type Suggestion =
  | { status: "no-data" }
  | { status: "no-working-sets"; last: Entry }
  | { status: "increase"; from: number; to: number; resetReps: number; needed: number; big: boolean; date: string }
  | { status: "decrease"; from: number; to: number; bottom: number; bestReps: number; date: string }
  | { status: "stall"; weight: number; to: number; sessions: number; date: string }
  | {
      status: "add-reps"; weight: number; sets: SetEntry[]; bestReps: number; targetReps: number; top: number;
      progress: number; needed: number; lastReps: number[]; targetSets: number[]; date: string;
    };

function topBottom(type: ExerciseType, settings: Settings) {
  const s = settings[type] || settings.compound;
  return { top: s.repTop, bottom: s.repBottom };
}

// Best working-set reps at a given weight in a session's entry, or 0 if none.
function bestRepsAtWeight(entry: Entry, weight: number): number {
  const reps = entry.sets.filter((s) => !s.warmup && s.weight === weight).map((s) => s.reps);
  return reps.length ? Math.max(...reps) : 0;
}

// Double progression: earn reps up to the top of the range, then add weight and
// reset. Reads recent history so it can also spot blowouts (big jump) and stalls
// (deload). Precedence: increase → decrease (too heavy) → stall → add reps.
export function getSuggestion(exercise: Exercise, entriesDesc: Entry[], settings: Settings): Suggestion {
  if (!entriesDesc.length) return { status: "no-data" };
  const last = entriesDesc[0]!;
  const working = last.sets.filter((s) => !s.warmup);
  if (!working.length) return { status: "no-working-sets", last };
  const { top, bottom } = topBottom(exercise.type, settings);
  const needed = settings[exercise.type]?.sets ?? 2;
  const increment = settings.increment;
  const round = plateIncrement(settings.unit);

  const byWeight: Record<string, number[]> = {};
  working.forEach((s) => {
    (byWeight[s.weight] ??= []).push(s.reps);
  });

  let increaseWeight: number | null = null;
  for (const [w, repsArr] of Object.entries(byWeight)) {
    const countTop = repsArr.filter((r) => r >= top).length;
    if (countTop >= needed) increaseWeight = Math.max(increaseWeight || 0, Number(w));
  }

  if (increaseWeight != null) {
    // Blowout: crushed every set at that weight by top + margin → double the jump.
    const repsAtInc = byWeight[increaseWeight] || [];
    const big = repsAtInc.length >= needed && repsAtInc.every((r) => r >= top + BLOWOUT_MARGIN);
    const to = increaseWeight + (big ? 2 : 1) * increment;
    return { status: "increase", from: increaseWeight, to, resetReps: bottom, needed, big, date: last.date };
  }

  const mainWeight = Math.max(...working.map((s) => s.weight));
  const setsAtMain = working.filter((s) => s.weight === mainWeight);
  const bestReps = Math.max(...setsAtMain.map((s) => s.reps));

  // Fell below the target range even on your best set here — the weight's too
  // heavy. Drop a step and rebuild reps from the bottom of the range.
  if (bestReps < bottom) {
    const to = Math.max(round, mainWeight - increment);
    return { status: "decrease", from: mainWeight, to, bottom, bestReps, date: last.date };
  }

  // Stall: same top weight for STALL_SESSIONS straight with no rep improvement.
  // Count the consecutive most-recent sessions whose top working weight matches.
  const run: Entry[] = [];
  for (const entry of entriesDesc) {
    const w = entry.sets.filter((s) => !s.warmup);
    if (!w.length) continue; // ignore warm-up-only days
    if (Math.max(...w.map((s) => s.weight)) !== mainWeight) break;
    run.push(entry);
  }
  if (run.length >= STALL_SESSIONS) {
    const oldestBest = bestRepsAtWeight(run[STALL_SESSIONS - 1]!, mainWeight);
    if (bestReps <= oldestBest) {
      const to = Math.max(round, Math.round((mainWeight * DELOAD_PCT) / round) * round);
      return { status: "stall", weight: mainWeight, to, sessions: run.length, date: last.date };
    }
  }

  // In range but not at the top yet — coach reps at the top working weight, with
  // a concrete per-set target (bump the lowest sub-top set by one).
  const progress = setsAtMain.filter((s) => s.reps >= top).length;
  const targetReps = Math.min(top, bestReps + 1);
  const lastReps = setsAtMain.map((s) => s.reps);
  const targetSets = [...lastReps];
  let bumpIdx = -1;
  let bumpVal = Infinity;
  targetSets.forEach((r, i) => {
    if (r < top && r < bumpVal) {
      bumpVal = r;
      bumpIdx = i;
    }
  });
  if (bumpIdx >= 0) targetSets[bumpIdx] = Math.min(top, targetSets[bumpIdx]! + 1);
  return { status: "add-reps", weight: mainWeight, sets: setsAtMain, bestReps, targetReps, top, progress, needed, lastReps, targetSets, date: last.date };
}

export function getSuggestedTargetWeight(exercise: Exercise, entriesDesc: Entry[], settings: Settings): number | null {
  const suggestion = getSuggestion(exercise, entriesDesc, settings);
  if (suggestion.status === "increase" || suggestion.status === "decrease" || suggestion.status === "stall") return suggestion.to;
  if (suggestion.status === "add-reps") return suggestion.weight;
  return null;
}
