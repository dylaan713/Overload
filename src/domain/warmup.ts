// Even-percentage warm-up ramp toward the working weight, rounded to the lift's step.
export function warmupRamp(target: number | null, count: number, step: number): { weight: number; reps: number }[] {
  if (target == null || target <= 0 || count <= 0 || step <= 0) return [];
  const START_PCT = 0.45;
  const END_PCT = 0.9;
  const START_REPS = 8;
  const END_REPS = 3;

  const sets: { weight: number; reps: number }[] = [];
  for (let i = 0; i < count; i++) {
    // t goes 0..1 across the sets; a single set sits at a sensible ~60%.
    const t = count === 1 ? 0.33 : i / (count - 1);
    const pct = START_PCT + (END_PCT - START_PCT) * t;
    const reps = Math.round(START_REPS + (END_REPS - START_REPS) * t);
    const weight = Math.round((target * pct) / step) * step;
    sets.push({ weight, reps });
  }
  // Drop anything that rounds to nothing or meets/exceeds the working weight.
  return sets.filter((s) => s.weight > 0 && s.weight < target);
}
