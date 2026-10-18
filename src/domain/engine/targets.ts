import { daysBetween } from "../dates";
import { lighter, loadStep, phaseOf, rulesFor } from "../settings";
import type { StoreDoc } from "../types";
import { warmupRamp } from "../warmup";
import { liftHistory } from "./history";
import { buildReps, phaseStartTargets, progressTargets, type Pick, type Rule } from "./progress";
import { isBad, stallFireIndex } from "./setbacks";

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
  const found = doc.exercises.find((e) => e.id === exerciseId);
  if (!found) throw new Error(`Unknown exercise ${exerciseId}`);
  const ex = found;
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
    pick = setbackTargets() ?? progressTargets(ex, h, rules, step, h[1] && h[1].W === h[0]!.W ? h[1] : undefined, unit);
  }

  // Rules 4, 5 and 3, in that order. Null when none applies.
  function setbackTargets(): Pick | null {
    const last = h[0]!;
    const n = rules.sets;
    const band = ex.equipment === "band";
    // "Lighter" means easier: 90% / one step on external lifts, one step of load or assistance otherwise.
    const easier = (pct: number) => (band ? null : lighter(ex, last.W, step, ex.loadKind === "external" ? { pct } : { steps: 1 }));

    if (isBad(last, h[1], rules) && h[1] && isBad(h[1], h[2], rules)) {
      const weight = band ? null : lighter(ex, last.W, step, { steps: 1 });
      const at = weight === null ? "an easier band" : `${weight} ${unit}`;
      return { rule: "drop", weight, reps: Array(n).fill(rules.repLow), reason: `Two off sessions in a row, so drop to ${at} and rebuild.` };
    }

    const hPhase = h.filter((s) => s.phaseId === phaseId);
    const k = stallFireIndex(hPhase);
    const stallReason = `No progress on ${ex.name} in 3 sessions.`;
    if (k === 0 && rules.style === "strength") {
      return { rule: "stall-deload", weight: easier(0.9), reps: Array(n).fill(rules.repHigh), reason: stallReason };
    }
    if (k !== null && rules.style === "hypertrophy" && daysBetween(hPhase[k]!.date, today) <= 7) {
      return {
        rule: "stall-volume", weight: band ? null : last.W, reps: buildReps(last, rules, undefined, band).slice(0, Math.ceil(n / 2)),
        reason: `${stallReason} Half the sets this week.`,
      };
    }

    if (isBad(last, h[1], rules)) {
      return { rule: "repeat", weight: band ? null : h[1]!.W, reps: buildReps(h[1]!, rules, undefined, band), reason: "Last session was off, so same weight, try again." };
    }
    return null;
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
