import { floorTo } from "../settings";
import { displayE1rm } from "../strength";
import type { Exercise, StoreDoc } from "../types";
import { liftHistory } from "./history";
import type { LiftTargets } from "./targets";

const LADDER = [0.8, 0.88, 0.95];

/** Rule 9: singles stepping up to ~95% of the current estimate. Exercise-only; the ladder is a suggestion. */
export function testTargets(ex: Exercise, doc: StoreDoc, today: string, step: number): Pick<LiftTargets, "rule" | "weight" | "ladder" | "sets" | "reason"> {
  const recent = liftHistory(doc, ex.id, today).slice(0, 3);
  const e = Math.max(0, ...recent.map((s) => displayE1rm(s.sets)));
  if (e <= 0) {
    return { rule: "test-day", weight: null, ladder: [], sets: [], reason: "Log a few sessions of this lift first, so there's a max to test." };
  }
  const ladder = LADDER.map((p) => Math.max(step, floorTo(e * p, step)));
  return {
    rule: "test-day", weight: ladder.at(-1)!, ladder,
    sets: ladder.map(() => ({ reps: 1, rirLow: 1, rirHigh: 2 })),
    reason: `Test day: work up in singles to about 95% of your ${Math.round(e)} estimate.`,
  };
}

/** The best test-block set by display estimate, for records. */
export function bestTest(doc: StoreDoc, exerciseId: string): { weight: number; reps: number; date: string; e1rm: number } | null {
  let best: { weight: number; reps: number; date: string; e1rm: number } | null = null;
  for (const s of doc.sessions) {
    for (const b of s.blocks) {
      if (b.exerciseId !== exerciseId || !b.test) continue;
      for (const set of b.sets) {
        const e1rm = displayE1rm([set]);
        if (e1rm > 0 && (!best || e1rm > best.e1rm)) best = { weight: set.weight, reps: set.reps, date: s.date, e1rm };
      }
    }
  }
  return best;
}
