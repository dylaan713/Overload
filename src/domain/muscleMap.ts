import { MUSCLE_LABEL } from "./library/muscles";
import { progressSummary, trendOf, type LiftProgress, type Trend } from "./progress";
import { phaseOf } from "./settings";
import { MUSCLES, type Muscle, type StoreDoc } from "./types";
import { weeklyVolume } from "./volume";

export type WeekState = "none" | "under-half" | "almost" | "in" | "over";
/** `stalled`: the muscle's counted lifts are flat or falling, the only case where being over the range is a concern. */
export interface WeekCell { state: WeekState; sets: number; low: number; high: number; stalled: boolean }
export interface StrengthCell { state: Trend | "no-data"; lifts: LiftProgress[] } // counted lifts whose primary includes the muscle

const fmt = (n: number) => String(Math.round(n * 10) / 10);

function weekState(sets: number, low: number, high: number): WeekState {
  if (sets <= 0) return "none";
  if (sets < low / 2) return "under-half";
  if (sets < low) return "almost";
  return sets > high ? "over" : "in";
}

/** This week's sets per muscle against the current style's range (same counts as the Log's "Still short"). */
export function weekMap(doc: StoreDoc, today: string): Record<Muscle, WeekCell> {
  const style = doc.settings.styles[phaseOf(doc.settings, today).style].volume;
  const rows = new Map(weeklyVolume(doc, today).map((r) => [r.muscle, r]));
  const strength = strengthMap(doc, today);
  return Object.fromEntries(MUSCLES.map((m) => {
    const row = rows.get(m);
    const sets = row?.sets ?? 0;
    // A lighter week halves the range; weeklyVolume carries that for listed muscles.
    const low = row?.low ?? style.low;
    const high = row?.high ?? style.high;
    const stalled = strength[m].state === "flat" || strength[m].state === "down";
    return [m, { state: weekState(sets, low, high), sets, low, high, stalled }];
  })) as Record<Muscle, WeekCell>;
}

/** Each muscle by the average 8-week change of the counted lifts that mainly work it. */
export function strengthMap(doc: StoreDoc, today: string): Record<Muscle, StrengthCell> {
  const primary = new Map(doc.exercises.map((e) => [e.id, e.primary]));
  const counted = progressSummary(doc, today).lifts.filter((l) => l.pct !== null);
  return Object.fromEntries(MUSCLES.map((m) => {
    const lifts = counted.filter((l) => primary.get(l.exerciseId)?.includes(m));
    if (lifts.length === 0) return [m, { state: "no-data", lifts }];
    return [m, { state: trendOf(lifts.reduce((a, l) => a + l.pct!, 0) / lifts.length), lifts }];
  })) as Record<Muscle, StrengthCell>;
}

/** The tap panel's sentence for one muscle this week. */
export function weekLine(muscle: Muscle, cell: WeekCell): string {
  const label = MUSCLE_LABEL[muscle];
  // Gains keep rising past 20 sets, more slowly; only a muscle that's over and not improving should cut back.
  if (cell.state === "over") {
    return cell.stalled
      ? `${label} · ${fmt(cell.sets)}, above ${cell.high} and not improving — try fewer next week`
      : `${label} · ${fmt(cell.sets)}, above ${cell.high} · fine while lifts improve`;
  }
  const base = `${label} · ${fmt(cell.sets)} of ${cell.low}–${cell.high} sets this week`;
  return cell.state === "in" ? base : `${base} · add ${Math.ceil(cell.low - cell.sets)}`;
}
