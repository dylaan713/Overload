import type { ClassRules } from "../types";
import { beats, type LiftSession } from "./history";

/**
 * Rule 3: a session is bad only against the previous session of the lift at the same W in the same phase,
 * so intentional drops, deloads, returns and phase starts are never "bad".
 */
export function isBad(cur: LiftSession, prev: LiftSession | undefined, rules: ClassRules): boolean {
  if (!prev || prev.W !== cur.W || prev.phaseId !== cur.phaseId) return false;
  return cur.best <= prev.best - 2 || cur.atW[0]!.reps < rules.repLow;
}

const STALL_WINDOW = 3;
const STALL_MIN_SESSIONS = 4;
/** After a fire, the next one needs 3 more sessions beyond the response session. */
const STALL_COOLDOWN = 4;

function stalledAt(chrono: LiftSession[], j: number): boolean {
  if (j + 1 < STALL_MIN_SESSIONS) return false;
  const recent = chrono.slice(j + 1 - STALL_WINDOW, j + 1);
  const older = chrono.slice(0, j + 1 - STALL_WINDOW);
  const best = older.reduce((a, b) => (beats(b, a) ? b : a));
  if (recent.some((s) => beats(s, best))) return false;
  const rated = recent.flatMap((s) => s.atW).filter((s) => s.rir !== null);
  return rated.length === 0 || rated.reduce((a, s) => a + s.rir!, 0) / rated.length <= 1;
}

/**
 * Rule 5. `hPhase` is the current phase's sessions, newest first. Returns the newest stall fire's
 * position in `hPhase` (0 = the newest session completed a stall), or null. Derived from history, no stored state.
 */
export function stallFireIndex(hPhase: LiftSession[]): number | null {
  const chrono = [...hPhase].reverse();
  let lastFire = -Infinity;
  for (let j = 0; j < chrono.length; j++) {
    if (stalledAt(chrono, j) && j >= lastFire + STALL_COOLDOWN) lastFire = j;
  }
  return lastFire === -Infinity ? null : chrono.length - 1 - lastFire;
}
