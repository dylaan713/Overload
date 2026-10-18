import { heavier, nearestTo } from "../settings";
import { predictE1rm, repsAt } from "../strength";
import type { ClassRules, Exercise, Unit } from "../types";
import type { LiftSession } from "./history";

export type Rule = "first-time" | "earn" | "earn-double" | "extend-reps" | "build-reps" | "repeat" | "drop" | "stall-deload"
  | "stall-volume" | "fatigue-week" | "return" | "phase-start" | "test-day";

export interface Pick {
  rule: Rule;
  weight: number | null;
  reps: number[];
  reason: string;
}

/** How many reps beyond repHigh a big-jump lift may build before it moves up anyway. */
export const EXTEND_LIMIT = 6;

const isBand = (ex: Exercise) => ex.equipment === "band";
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
const bestE1rm = (s: LiftSession) => Math.max(...s.atW.map(predictE1rm));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rule 2 on one session: last time's reps at W, padded to the style's set count, with one set bumped. */
export function buildReps(last: LiftSession, rules: ClassRules, prevSameW?: LiftSession, uncapped = false): number[] {
  const n = rules.sets;
  const lastReps = last.atW.map((s) => s.reps);
  const base = Array.from({ length: n }, (_, i) => lastReps[Math.min(i, lastReps.length - 1)]!);
  const rated = last.atW.every((s) => s.rir !== null);
  const avgRir = rated ? sum(last.atW.map((s) => s.rir!)) / last.atW.length : null;

  // A hard session that already lost reps: hold rather than push.
  if (avgRir !== null && avgRir < rules.rirLow && prevSameW && prevSameW.W === last.W && sum(prevSameW.atW.map((s) => s.reps)) > sum(lastReps)) {
    return base;
  }
  const candidates = base.map((r, i) => [r, i] as const).filter(([r]) => uncapped || r < rules.repHigh);
  if (candidates.length === 0) return base;
  const low = Math.min(...candidates.map(([r]) => r));
  const i = candidates.find(([r]) => r === low)![1];
  const bump = avgRir !== null && avgRir > rules.rirHigh ? 2 : 1;
  base[i] = uncapped ? base[i]! + bump : Math.min(rules.repHigh, base[i]! + bump);
  return base;
}

/** Rules 1 (earn / extend) and 2 (build) for a lift with history. */
export function progressTargets(ex: Exercise, h: LiftSession[], rules: ClassRules, step: number, prevSameW?: LiftSession, unit: Unit = "lb"): Pick {
  const last = h[0]!;
  const { W } = last;
  const n = rules.sets;

  if (isBand(ex)) {
    const reps = buildReps(last, rules, prevSameW, true);
    const reason = last.best > rules.repHigh + 5
      ? `Reps are past ${rules.repHigh + 5}, so move to the next band.`
      : "Add a rep where you can.";
    return { rule: "build-reps", weight: null, reps, reason };
  }

  const topped = last.atW.filter((s) => s.reps >= rules.repHigh).length >= n;
  if (topped) {
    if (ex.loadKind !== "external" || W <= 0) {
      const next = heavier(ex, W, step);
      return { rule: "earn", weight: next, reps: fill(n, rules.repLow), reason: `Top of the range on every set, so move to ${next} ${unit}.` };
    }
    const e = bestE1rm(last);
    const double = heavier(ex, W, step, 2);
    if (last.atW.every((s) => s.rir !== null && s.rir >= 3) && repsAt(double, e) >= rules.repLow) {
      return { rule: "earn-double", weight: double, reps: fill(n, rules.repLow), reason: `That was easy, so jump two steps to ${double} ${unit}.` };
    }
    const next = heavier(ex, W, step);
    const ceiling = rules.repHigh + EXTEND_LIMIT;
    const minReps = Math.min(...last.atW.map((s) => s.reps));
    if (repsAt(next, e) >= rules.repLow || minReps >= ceiling) {
      return { rule: "earn", weight: next, reps: fill(n, rules.repLow), reason: `Top of the range on every set, so move to ${next} ${unit}.` };
    }
    return {
      rule: "extend-reps", weight: W, reps: fill(n, Math.min(ceiling, minReps + 1)),
      reason: `${next} ${unit} is a big jump from ${W} ${unit}, so build to ${ceiling} reps here first.`,
    };
  }

  return { rule: "build-reps", weight: W, reps: buildReps(last, rules, prevSameW), reason: `Stay at ${W} ${unit} and add a rep where you can.` };
}

/** Rule 8: the first session of a lift in a new phase keeps W and retargets reps (or steps down to reach repLow). */
export function phaseStartTargets(ex: Exercise, last: LiftSession, rules: ClassRules, step: number, unit: Unit = "lb"): Pick {
  const n = rules.sets;
  const reason = "New training phase, so reps move into the new range.";
  if (isBand(ex)) return { rule: "phase-start", weight: null, reps: fill(n, clamp(last.best, rules.repLow, rules.repHigh)), reason };
  if (ex.loadKind !== "external" || last.W <= 0) {
    return { rule: "phase-start", weight: last.W, reps: fill(n, clamp(last.best, rules.repLow, rules.repHigh)), reason };
  }
  const e = bestE1rm(last);
  // Start on the grid; a non-positive step can't step down (and must never loop).
  let weight = step > 0 ? Math.max(step, nearestTo(last.W, step)) : last.W;
  while (step > 0 && weight > step && repsAt(weight, e) < rules.repLow) weight = Math.max(step, weight - step);
  const reps = clamp(repsAt(weight, e) - rules.rirHigh, rules.repLow, rules.repHigh);
  return {
    rule: "phase-start", weight, reps: fill(n, reps),
    reason: weight < last.W ? `New training phase, so drop to ${weight} ${unit} to reach ${rules.repLow} reps.` : reason,
  };
}
