// Verbatim copy of the pre-rewrite engine from main:src/App.jsx (lines 36-59, 190-200, 218-330).
// Test-only reference for golden tests. Do not edit; do not import from app code.
const DEFAULT_SETTINGS = {
  unit: "lb", // "lb" | "kg"
  increment: 5, // amount added on an increase, in the current unit
  compound: { sets: 2, repBottom: 6, repTop: 8, warmupSets: 2 },
  isolation: { sets: 2, repBottom: 8, repTop: 10, warmupSets: 1 },
  restTimer: { defaultSeconds: 120 },
  theme: "ember",
};

// Merge stored settings over defaults so older/partial saves don't break.
function mergeSettings(stored) {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    compound: { ...DEFAULT_SETTINGS.compound, ...(stored.compound || {}) },
    isolation: { ...DEFAULT_SETTINGS.isolation, ...(stored.isolation || {}) },
    restTimer: { ...DEFAULT_SETTINGS.restTimer, ...(stored.restTimer || {}) },
  };
}

function plateIncrement(unit) {
  return unit === "kg" ? 2.5 : 5;
}
function topBottom(type, settings) {
  const s = settings[type] || settings.compound;
  return { top: s.repTop, bottom: s.repBottom };
}

// Epley estimated 1-rep max. Combines weight AND reps into one strength number
// so rep gains (not just heavier loads) show up as progress on the chart.
function e1rm(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}
// Even-percentage warm-up ramp. The count comes from settings; weights and reps
// are calculated from the target working weight so the user only picks "how many".
function getWarmupSets(type, targetWeight, settings) {
  const count = settings[type]?.warmupSets ?? 0;
  if (!count || count <= 0 || !targetWeight || targetWeight <= 0) return [];
  const round = plateIncrement(settings.unit);
  const START_PCT = 0.45;
  const END_PCT = 0.9;
  const START_REPS = 8;
  const END_REPS = 3;

  const sets = [];
  for (let i = 0; i < count; i++) {
    // t goes 0..1 across the sets; a single set sits at a sensible ~60%.
    const t = count === 1 ? 0.33 : i / (count - 1);
    const pct = START_PCT + (END_PCT - START_PCT) * t;
    const reps = Math.round(START_REPS + (END_REPS - START_REPS) * t);
    const weight = Math.round((targetWeight * pct) / round) * round;
    sets.push({ weight, reps });
  }
  // Drop anything that rounds to nothing or meets/exceeds the working weight.
  return sets.filter((s) => s.weight > 0 && s.weight < targetWeight);
}

// Coaching tuning.
const STALL_SESSIONS = 3; // same top weight, no rep gain, this many sessions → deload
const BLOWOUT_MARGIN = 3; // reps past the top of the range that earn a double jump
const DELOAD_PCT = 0.9; // deload target = 90% of the stalled weight

// Best working-set reps at a given weight in a session's entry, or 0 if none.
function bestRepsAtWeight(entry, weight) {
  const reps = entry.sets.filter((s) => !s.warmup && s.weight === weight).map((s) => s.reps);
  return reps.length ? Math.max(...reps) : 0;
}

// Double progression: earn reps up to the top of the range, then add weight and
// reset. Reads recent history so it can also spot blowouts (big jump) and stalls
// (deload). Precedence: increase → decrease (too heavy) → stall → add reps.
function getSuggestion(exercise, entriesDesc, settings) {
  if (!entriesDesc.length) return { status: "no-data" };
  const last = entriesDesc[0];
  const working = last.sets.filter((s) => !s.warmup);
  if (!working.length) return { status: "no-working-sets", last };
  const { top, bottom } = topBottom(exercise.type, settings);
  const needed = settings[exercise.type]?.sets ?? 2;
  const increment = settings.increment;
  const round = plateIncrement(settings.unit);

  const byWeight = {};
  working.forEach((s) => {
    byWeight[s.weight] = byWeight[s.weight] || [];
    byWeight[s.weight].push(s.reps);
  });

  let increaseWeight = null;
  Object.entries(byWeight).forEach(([w, repsArr]) => {
    const countTop = repsArr.filter((r) => r >= top).length;
    if (countTop >= needed) increaseWeight = Math.max(increaseWeight || 0, Number(w));
  });

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
  const run = [];
  for (const entry of entriesDesc) {
    const w = entry.sets.filter((s) => !s.warmup);
    if (!w.length) continue; // ignore warm-up-only days
    if (Math.max(...w.map((s) => s.weight)) !== mainWeight) break;
    run.push(entry);
  }
  if (run.length >= STALL_SESSIONS) {
    const oldestBest = bestRepsAtWeight(run[STALL_SESSIONS - 1], mainWeight);
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
  if (bumpIdx >= 0) targetSets[bumpIdx] = Math.min(top, targetSets[bumpIdx] + 1);
  return { status: "add-reps", weight: mainWeight, sets: setsAtMain, bestReps, targetReps, top, progress, needed, lastReps, targetSets, date: last.date };
}
export { DEFAULT_SETTINGS, mergeSettings, plateIncrement, e1rm, getWarmupSets, getSuggestion };
