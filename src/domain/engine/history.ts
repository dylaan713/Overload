import { phaseOf } from "../settings";
import type { SetEntry, StoreDoc } from "../types";

/** One day's work on a lift, as the coaching rules read it. */
export interface LiftSession {
  date: string;
  phaseId: string;
  sets: SetEntry[]; // working sets of every non-test block that day, in logged order
  W: number; // top working weight
  atW: SetEntry[]; // sets at exactly W, in logged order
  best: number; // max reps at W
}

/** Newest first. Ignores test blocks, warm-ups, days with no working sets and dates after `today`. */
export function liftHistory(doc: StoreDoc, exerciseId: string, today: string): LiftSession[] {
  const byDate = new Map<string, SetEntry[]>();
  for (const s of doc.sessions) {
    if (s.date > today) continue;
    for (const b of s.blocks) {
      if (b.exerciseId !== exerciseId || b.test) continue;
      const work = b.sets.filter((x) => !x.warmup);
      if (work.length) byDate.set(s.date, [...(byDate.get(s.date) ?? []), ...work]);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, sets]) => {
      const W = Math.max(...sets.map((x) => x.weight));
      const atW = sets.filter((x) => x.weight === W);
      return { date, phaseId: phaseOf(doc.settings, date).id, sets, W, atW, best: Math.max(...atW.map((x) => x.reps)) };
    });
}

/** Heavier, or the same weight with more reps. */
export function beats(a: { W: number; best: number }, b: { W: number; best: number }): boolean {
  return a.W > b.W || (a.W === b.W && a.best > b.best);
}
