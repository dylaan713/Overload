import { addDays, weekStart } from "./dates";
import { MUSCLE_LABEL } from "./library/muscles";
import { phaseOf } from "./settings";
import type { Exercise, Muscle, SetEntry, StoreDoc } from "./types";

export const WINDOW_DAYS = 56;
export const MIN_SESSIONS = 3;
const NEAR_FAILURE = 2; // reps-left is only trusted at Moderate (2) or harder
const REP_CAP = 12;
const ATTENTION_MAX = 3;
const VOLUME_WEEKS = 4;

export type Metric = "e1rm" | "reps";
export type Trend = "down" | "flat" | "up" | "up-a-lot";
export interface SeriesPoint { date: string; value: number; test: boolean; phaseStart: boolean }
export interface LiftProgress {
  exerciseId: string;
  name: string;
  metric: Metric;
  sessions: number; // in the window
  points: SeriesPoint[]; // in the window, oldest first
  change: number | null; // in the user's unit (e1rm) or reps; null under MIN_SESSIONS
  pct: number | null;
  trend: Trend | null;
}
export interface Attention { exerciseId: string; name: string; reason: string }
export interface ProgressSummary { stronger: number; counted: number; avgPct: number | null; lifts: LiftProgress[]; attention: Attention[] }

const working = (sets: SetEntry[]) => sets.filter((s) => !s.warmup);

/**
 * Reps a set could have been taken to, trusting the rating only near failure: people judge reps-left well within
 * about 2 of failure and badly beyond it, and Easy is open-ended ("4+"). So Easy or unrated sets count as done.
 */
function trustedReps(s: SetEntry): number {
  return s.reps + (s.rir !== null && s.rir <= NEAR_FAILURE ? s.rir : 0);
}

/** Est. 1RM for one session: Moderate/Hard/All-out sets add reps-left (cap 12 effective reps); Easy and unrated add nothing. */
export function sessionE1rm(sets: SetEntry[]): number {
  const work = working(sets).filter((s) => s.weight > 0);
  if (work.length === 0) return 0;
  const qualifying = work.filter((s) => trustedReps(s) <= REP_CAP);
  const pool = qualifying.length ? qualifying : work;
  return Math.round(Math.max(...pool.map((s) => s.weight * (1 + Math.min(trustedReps(s), REP_CAP) / 30))));
}

/** Bands, assisted lifts and unloaded bodyweight work are tracked by reps; anything with load by est. 1RM. */
export function metricOf(ex: Exercise, sets: SetEntry[]): Metric {
  if (ex.equipment === "band" || ex.loadKind === "assisted") return "reps";
  if (ex.loadKind === "bodyweight" && working(sets).every((s) => s.weight === 0)) return "reps";
  return "e1rm";
}

export function trendOf(pct: number): Trend {
  if (pct < -2) return "down";
  if (pct <= 2) return "flat";
  return pct < 5 ? "up" : "up-a-lot";
}

/** Working sets per date for one exercise (test blocks included), from..to inclusive. */
function setsByDate(doc: StoreDoc, exerciseId: string, from: string, to: string): Map<string, SetEntry[]> {
  const out = new Map<string, SetEntry[]>();
  for (const s of doc.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const b of s.blocks) {
      if (b.exerciseId !== exerciseId) continue;
      const work = working(b.sets);
      if (work.length) out.set(s.date, [...(out.get(s.date) ?? []), ...work]);
    }
  }
  return out;
}

const hasTest = (doc: StoreDoc, exerciseId: string, date: string) =>
  doc.sessions.some((s) => s.date === date && s.blocks.some((b) => b.exerciseId === exerciseId && b.test));

/** One point per day with working sets, oldest first. The metric is chosen from the sets in range. */
export function liftSeries(doc: StoreDoc, exerciseId: string, from: string, to: string): SeriesPoint[] {
  const ex = doc.exercises.find((e) => e.id === exerciseId);
  if (!ex) return [];
  const byDate = setsByDate(doc, exerciseId, from, to);
  const metric = metricOf(ex, [...byDate.values()].flat());
  const earliest = [...doc.settings.phases].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]?.id;
  let prevPhase: string | null = null;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sets]) => {
      const phase = phaseOf(doc.settings, date);
      const phaseStart = prevPhase === null ? phase.id !== earliest && phase.startDate >= from : phase.id !== prevPhase;
      prevPhase = phase.id;
      const value = metric === "reps" ? Math.max(...sets.map(trustedReps)) : sessionE1rm(sets);
      return { date, value, test: hasTest(doc, exerciseId, date), phaseStart };
    });
}

/** Average weekly sets for a muscle over the last complete weeks (primary 1, secondary ½), so Monday isn't "short". */
function avgWeeklySets(doc: StoreDoc, muscle: Muscle, today: string): number {
  const to = addDays(weekStart(today), -1);
  const from = addDays(weekStart(today), -7 * VOLUME_WEEKS);
  const exercises = new Map(doc.exercises.map((e) => [e.id, e]));
  let total = 0;
  for (const s of doc.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId);
      if (!ex) continue;
      const n = working(b.sets).length;
      if (ex.primary.includes(muscle)) total += n;
      else if (ex.secondary.includes(muscle)) total += n / 2;
    }
  }
  return total / VOLUME_WEEKS;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** One sentence on why a flat or falling lift isn't moving, most actionable cause first. */
function attentionReason(doc: StoreDoc, ex: Exercise, l: LiftProgress, from: string, today: string): string {
  const sets = [...setsByDate(doc, ex.id, from, today).values()].flat();
  const rated = sets.filter((s) => s.rir !== null);
  const avgRir = rated.length ? rated.reduce((a, s) => a + s.rir!, 0) / rated.length : null;
  if (avgRir !== null && avgRir >= 3) return "Most sets were Easy. Take them closer to failure.";
  if (l.trend === "down" && avgRir !== null && avgRir <= 0.5) {
    return "Every set was All out and it's dropping. Recovery is the limit; take the lighter week when the Log offers it.";
  }
  const muscle = ex.primary[0]!;
  const { low } = doc.settings.styles[phaseOf(doc.settings, today).style].volume;
  const weekly = avgWeeklySets(doc, muscle, today);
  if (weekly < low) return `${MUSCLE_LABEL[muscle]} gets ${fmt(weekly)} of ${low}+ sets a week. Add sets.`;
  if (rated.length * 2 < sets.length) return "Most sets have no difficulty, so coaching can't judge them. Tap one after each set.";
  return "No gain in 8 weeks. The Log changes the target when a lift stalls; follow it.";
}

/** The last 8 weeks: which lifts are getting stronger, by how much, and which need attention. */
export function progressSummary(doc: StoreDoc, today: string): ProgressSummary {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const lifts: LiftProgress[] = [];
  for (const ex of doc.exercises) {
    if (ex.archived) continue;
    const points = liftSeries(doc, ex.id, from, today);
    if (points.length === 0) continue;
    const metric = metricOf(ex, [...setsByDate(doc, ex.id, from, today).values()].flat());
    let change: number | null = null;
    let pct: number | null = null;
    let trend: Trend | null = null;
    const start = points.length >= MIN_SESSIONS ? Math.max(points[0]!.value, points[1]!.value) : 0;
    if (start > 0) {
      const end = Math.max(points.at(-1)!.value, points.at(-2)!.value);
      change = Math.round(end - start);
      pct = Math.round(((end - start) / start) * 1000) / 10;
      trend = trendOf(pct);
    }
    lifts.push({ exerciseId: ex.id, name: ex.name, metric, sessions: points.length, points, change, pct, trend });
  }
  lifts.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));

  const counted = lifts.filter((l) => l.trend !== null);
  const stronger = counted.filter((l) => l.trend === "up" || l.trend === "up-a-lot").length;
  const avgPct = counted.length ? Math.round(counted.reduce((a, l) => a + l.pct!, 0) / counted.length) : null;

  const exercises = new Map(doc.exercises.map((e) => [e.id, e]));
  const attention = counted
    .filter((l) => l.trend === "down" || l.trend === "flat")
    .sort((a, b) => (a.trend === b.trend ? 0 : a.trend === "down" ? -1 : 1) || a.pct! - b.pct! || a.name.localeCompare(b.name))
    .slice(0, ATTENTION_MAX)
    .map((l) => ({ exerciseId: l.exerciseId, name: l.name, reason: attentionReason(doc, exercises.get(l.exerciseId)!, l, from, today) }));

  return { stronger, counted: counted.length, avgPct, lifts, attention };
}
