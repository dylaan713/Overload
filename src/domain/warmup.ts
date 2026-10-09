import type { ExerciseType, Settings } from "./types";
import { plateIncrement } from "./settings";

// Even-percentage warm-up ramp. The count comes from settings; weights and reps
// are calculated from the target working weight so the user only picks "how many".
export function getWarmupSets(
  type: ExerciseType,
  targetWeight: number | null | undefined,
  settings: Settings,
): { weight: number; reps: number }[] {
  const count = settings[type]?.warmupSets ?? 0;
  if (!count || count <= 0 || !targetWeight || targetWeight <= 0) return [];
  const round = plateIncrement(settings.unit);
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
    const weight = Math.round((targetWeight * pct) / round) * round;
    sets.push({ weight, reps });
  }
  // Drop anything that rounds to nothing or meets/exceeds the working weight.
  return sets.filter((s) => s.weight > 0 && s.weight < targetWeight);
}
