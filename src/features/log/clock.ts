/**
 * The Log's two clocks. Pure, so the screen passes `now` and tests can drive them: neither one is allowed
 * to count up on its own forever — ending the workout stops both.
 */
export interface Clocks {
  /** The day's first set. */
  startedAt: number | null;
  /** The day's latest set. */
  lastAt: number | null;
  /** When the workout was ended by hand, if it was. */
  endedAt: number | null;
  now: number;
}

/** The workout's length: running while it's live, frozen at the end once it's over. */
export function workoutClock({ startedAt, endedAt, now }: Clocks): { ms: number; running: boolean } | null {
  if (startedAt == null) return null;
  // Clamped: a clock skew (or a stored time from the future) must not read as a negative workout.
  if (endedAt != null) return { ms: Math.max(0, endedAt - startedAt), running: false };
  return { ms: Math.max(0, now - startedAt), running: true };
}

/** How long since the last set, or null once the workout has ended — it isn't rest any more. */
export function restSince({ lastAt, endedAt, now }: Clocks): number | null {
  if (lastAt == null || endedAt != null) return null;
  return Math.max(0, now - lastAt);
}
