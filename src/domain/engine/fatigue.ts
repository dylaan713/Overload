import { addDays, weekStart as weekStartOf } from "../dates";
import { rulesFor } from "../settings";
import type { StoreDoc } from "../types";
import { liftHistory } from "./history";
import { isBad } from "./setbacks";

const MIN_LIFTS = 4;

/** Rule 6: an app-level suggestion, never applied automatically. */
export function fatigueSuggestion(doc: StoreDoc, today: string): { weekStart: string; reason: string } | null {
  const weekStart = weekStartOf(today);
  if (doc.coaching.fatigueWeeks.some((f) => f.weekStart === weekStart)) return null;
  let lifts = 0;
  let bad = 0;
  for (const ex of doc.exercises) {
    const h = liftHistory(doc, ex.id, today);
    if (!h[0] || h[0].date < weekStart) continue;
    lifts++;
    if (isBad(h[0], h[1], rulesFor(ex, doc.settings, today))) bad++;
  }
  if (lifts < MIN_LIFTS || bad * 2 < lifts) return null;
  return { weekStart, reason: "Most lifts were down this week — take a lighter week?" };
}

/** Records the user's Accept or Dismiss, replacing any earlier decision for that week. */
export function decideFatigue(doc: StoreDoc, weekStart: string, status: "accepted" | "dismissed", today: string): StoreDoc {
  const fatigueWeeks = [...doc.coaching.fatigueWeeks.filter((f) => f.weekStart !== weekStart), { weekStart, status, decidedOn: today }];
  return { ...doc, coaching: { ...doc.coaching, fatigueWeeks } };
}

/** True for the 7 days starting the day a lighter week was accepted. */
export function fatigueActive(doc: StoreDoc, date: string): boolean {
  return doc.coaching.fatigueWeeks.some((f) => f.status === "accepted" && f.decidedOn <= date && date <= addDays(f.decidedOn, 6));
}
