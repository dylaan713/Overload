import { loadStep, phaseOf, rulesFor } from "../settings";
import type { StoreDoc } from "../types";
import { warmupRamp } from "../warmup";
import { liftHistory } from "./history";
import { phaseStartTargets, progressTargets, type Pick, type Rule } from "./progress";

export type { Rule } from "./progress";

export interface SetTarget {
  reps: number;
  rirLow: number;
  rirHigh: number;
}

export interface LiftTargets {
  exerciseId: string;
  rule: Rule;
  weight: number | null;
  sets: SetTarget[];
  ladder?: number[];
  warmups: { weight: number; reps: number }[];
  reason: string; // one plain sentence
  restSeconds: number;
}

/** Today's suggestion for one lift. Pure: reads the doc, never writes. */
export function targetsFor(exerciseId: string, doc: StoreDoc, today: string, opts: { test?: boolean } = {}): LiftTargets {
  void opts; // test day arrives with rule 9
  const ex = doc.exercises.find((e) => e.id === exerciseId);
  if (!ex) throw new Error(`Unknown exercise ${exerciseId}`);
  const { settings } = doc;
  const rules = rulesFor(ex, settings, today);
  const step = loadStep(ex, settings);
  const unit = settings.unit;
  const h = liftHistory(doc, exerciseId, today);
  const phaseId = phaseOf(settings, today).id;

  let pick: Pick;
  if (h.length === 0) {
    pick = {
      rule: "first-time", weight: null, reps: Array.from({ length: rules.sets }, () => rules.repLow),
      reason: `First time: pick a weight you can lift for ${rules.repLow}–${rules.repHigh} reps with ${rules.rirLow}–${rules.rirHigh} left.`,
    };
  } else if (!h.some((s) => s.phaseId === phaseId)) {
    pick = phaseStartTargets(ex, h[0]!, rules, step, unit);
  } else {
    const prevSameW = h[1] && h[1].W === h[0]!.W ? h[1] : undefined;
    pick = progressTargets(ex, h, rules, step, prevSameW, unit);
  }

  return {
    exerciseId,
    rule: pick.rule,
    weight: pick.weight,
    sets: pick.reps.map((reps) => ({ reps, rirLow: rules.rirLow, rirHigh: rules.rirHigh })),
    warmups: ex.loadKind === "external" && pick.weight !== null ? warmupRamp(pick.weight, rules.warmupSets, step) : [],
    reason: pick.reason,
    restSeconds: rules.restSeconds,
  };
}
