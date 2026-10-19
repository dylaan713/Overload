import type { LiftProgress } from "../../domain/progress";
import type { Unit } from "../../domain/types";

/** "+13 lb", "−12 lb", "+2 reps", "flat", "Assisted, not scored" or "Not enough data yet". */
export function changeText(l: Pick<LiftProgress, "change" | "trend" | "metric" | "counts">, unit: Unit): string {
  if (!l.counts) return "Assisted, not scored";
  if (l.change === null || l.trend === null) return "Not enough data yet";
  if (l.trend === "flat") return "flat";
  const sign = l.change > 0 ? "+" : "−";
  return `${sign}${Math.abs(l.change)} ${l.metric === "reps" ? "reps" : unit}`;
}
