import { daysBetween } from "../dates";
import { lighter, nearestTo } from "../settings";
import type { Exercise, Unit } from "../types";
import type { LiftSession } from "./history";

export const RETURN_DAYS = 14;
const LONG_RETURN_DAYS = 28;

/**
 * Rule 7. After 14+ days off start at 90% (28+: 80%); bodyweight and assisted lifts ease off by one (two) steps.
 * The next two sessions climb back to the pre-layoff W in two equal steps. Null when no layoff applies.
 */
export function returnTargets(ex: Exercise, h: LiftSession[], today: string, step: number, unit: Unit = "lb"): { weight: number; reason: string } | null {
  if (ex.equipment === "band" || h.length === 0) return null;
  const [h0, h1, h2] = h as [LiftSession, LiftSession | undefined, LiftSession | undefined];
  const external = ex.loadKind === "external";

  const gap = daysBetween(h0.date, today);
  if (gap >= RETURN_DAYS) {
    const long = gap >= LONG_RETURN_DAYS;
    const weight = lighter(ex, h0.W, step, external ? { pct: long ? 0.8 : 0.9 } : { steps: long ? 2 : 1 });
    return { weight, reason: `Welcome back — starting lighter after ${gap} days off.` };
  }
  // "Lighter" is "easier": for assisted lifts that's a higher number.
  const easier = (a: number, b: number) => (ex.loadKind === "assisted" ? a > b : a < b);
  if (h1 && daysBetween(h1.date, h0.date) >= RETURN_DAYS && easier(h0.W, h1.W)) {
    return { weight: nearestTo((h0.W + h1.W) / 2, step), reason: `Building back to ${h1.W} ${unit}.` };
  }
  if (h1 && h2 && daysBetween(h2.date, h1.date) >= RETURN_DAYS && easier(h1.W, h2.W) && easier(h0.W, h2.W)) {
    return { weight: h2.W, reason: `Building back to ${h2.W} ${unit}.` };
  }
  return null;
}
