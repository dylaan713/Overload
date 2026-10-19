import { addDays, daysBetween, weekStart } from "./dates";
import { MUSCLE_LABEL } from "./library/muscles";
import { phaseOf } from "./settings";
import type { Exercise, Muscle, SetEntry, StoreDoc } from "./types";
import { setCredit } from "./volume";

export const WINDOW_DAYS = 56;
export const MIN_SESSIONS = 3;
/** A lift is judged only once its sessions span two weeks: three sessions in one week say nothing about progress. */
export const MIN_SPAN_DAYS = 14;
const NEAR_FAILURE = 2; // reps-left is only trusted at Moderate (2) or harder
const REP_CAP = 12;
const ATTENTION_MAX = 2;
const VOLUME_WEEKS = 4;

export type Metric = "e1rm" | "reps";
export type Trend = "down" | "flat" | "up" | "up-a-lot";
export interface SeriesPoint { date: string; value: number; test: boolean; phaseStart: boolean }
export interface LiftProgress {
  exerciseId: string;
  name: string;
  metric: Metric;
  sessions: number; // in the window
  /** false for assisted lifts: less assistance is progress even as reps fall, so they're shown but not scored. */
  counts: boolean;
  points: SeriesPoint[]; // in the window, oldest first
  change: number | null; // in the user's unit (e1rm) or reps; null under MIN_SESSIONS
  pct: number | null;
  trend: Trend | null;
}
export interface Attention { exerciseId: string; name: string; short: string; reason: string }
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
  // Any unloaded session: est. 1RM on added load would read it as zero, so track the lift by reps.
  if (ex.loadKind === "bodyweight" && working(sets).some((s) => s.weight === 0)) return "reps";
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

/** One point per day with working sets, oldest first. The metric is chosen from the sets in range unless given. */
export function liftSeries(doc: StoreDoc, exerciseId: string, from: string, to: string, metricIn?: Metric): SeriesPoint[] {
  const ex = doc.exercises.find((e) => e.id === exerciseId);
  if (!ex) return [];
  const byDate = setsByDate(doc, exerciseId, from, to);
  const metric = metricIn ?? metricOf(ex, [...byDate.values()].flat());
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

/**
 * Average weekly sets for a muscle (primary 1, secondary ½) over the last full weeks, counting only full weeks since
 * the first workout: weeks before it would read as zero. null until one full week is logged.
 */
function avgWeeklySets(doc: StoreDoc, muscle: Muscle, today: string): number | null {
  const first = doc.sessions.filter((s) => s.blocks.some((b) => b.sets.length)).map((s) => s.date).sort()[0];
  if (!first) return null;
  const firstFull = weekStart(first) === first ? first : addDays(weekStart(first), 7);
  const to = addDays(weekStart(today), -1);
  const from = [addDays(weekStart(today), -7 * VOLUME_WEEKS), firstFull].sort().at(-1)!;
  const weeks = Math.round((daysBetween(from, to) + 1) / 7);
  if (weeks <= 0) return null;
  const exercises = new Map(doc.exercises.map((e) => [e.id, e]));
  let total = 0;
  for (const s of doc.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId);
      if (!ex) continue;
      const n = b.test ? 0 : b.sets.reduce((a, x) => a + setCredit(x), 0);
      if (ex.primary.includes(muscle)) total += n;
      else if (ex.secondary.includes(muscle)) total += n / 2;
    }
  }
  return total / weeks;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Why a flat or falling lift isn't moving, most actionable cause first: one line for the list, a sentence for its chart. */
function attentionReason(doc: StoreDoc, ex: Exercise, l: LiftProgress, from: string, today: string): Pick<Attention, "short" | "reason"> {
  const sets = [...setsByDate(doc, ex.id, from, today).values()].flat();
  const rated = sets.filter((s) => s.rir !== null);
  const avgRir = rated.length ? rated.reduce((a, s) => a + s.rir!, 0) / rated.length : null;
  if (avgRir !== null && avgRir >= 3) return { short: "Mostly Easy sets: push closer to failure", reason: "Most sets were Easy. Take them closer to failure." };
  if (l.trend === "down" && l.metric === "e1rm" && avgRir !== null && avgRir <= 0.5) {
    return {
      short: "All out and dropping: take the lighter week",
      reason: "Every set was All out and it's dropping. Recovery is the limit; take the lighter week when the Log offers it.",
    };
  }
  const muscle = ex.primary[0]!;
  const { low } = doc.settings.styles[phaseOf(doc.settings, today).style].volume;
  const weekly = avgWeeklySets(doc, muscle, today);
  if (weekly !== null && weekly < low) {
    const label = MUSCLE_LABEL[muscle];
    return { short: `${label} short on sets: ${fmt(weekly)} of ${low}+ a week`, reason: `${label} gets ${fmt(weekly)} of ${low}+ sets a week. Add sets.` };
  }
  if (rated.length * 2 < sets.length) {
    return { short: "Most sets unrated: tap a difficulty", reason: "Most sets have no difficulty, so coaching can't judge them. Tap one after each set." };
  }
  const weeks = Math.max(1, Math.round(daysBetween(l.points[0]!.date, today) / 7));
  const span = `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  return { short: `No gain in ${span}: follow the Log's target`, reason: `No gain in ${span}. The Log changes the target when a lift stalls; follow it.` };
}

/** Why one lift is flat or falling over the last 8 weeks, or null when it's going up or has too little data. */
export function attentionFor(doc: StoreDoc, today: string, exerciseId: string): Attention | null {
  const l = progressSummary(doc, today).lifts.find((x) => x.exerciseId === exerciseId);
  return l ? explain(doc, l, today) : null;
}

function explain(doc: StoreDoc, l: LiftProgress, today: string): Attention | null {
  const ex = doc.exercises.find((e) => e.id === l.exerciseId);
  if (!ex || (l.trend !== "down" && l.trend !== "flat")) return null;
  return { exerciseId: l.exerciseId, name: l.name, ...attentionReason(doc, ex, l, addDays(today, -(WINDOW_DAYS - 1)), today) };
}

/** The last 8 weeks: which lifts are getting stronger, by how much, and which need attention. */
export function progressSummary(doc: StoreDoc, today: string): ProgressSummary {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const lifts: LiftProgress[] = [];
  for (const ex of doc.exercises) {
    if (ex.archived) continue;
    const metric = metricOf(ex, [...setsByDate(doc, ex.id, from, today).values()].flat());
    const points = liftSeries(doc, ex.id, from, today, metric);
    if (points.length === 0) continue;
    const counts = ex.loadKind !== "assisted";
    let change: number | null = null;
    let pct: number | null = null;
    let trend: Trend | null = null;
    const judged = counts && points.length >= MIN_SESSIONS && daysBetween(points[0]!.date, points.at(-1)!.date) >= MIN_SPAN_DAYS;
    // Best of the first two vs best of the last two damps one bad day; with three sessions they'd share the middle one.
    const ends = points.length >= 4 ? 2 : 1;
    const start = judged ? Math.max(...points.slice(0, ends).map((p) => p.value)) : 0;
    if (start > 0) {
      const end = Math.max(...points.slice(-ends).map((p) => p.value));
      change = Math.round(end - start);
      pct = Math.round(((end - start) / start) * 1000) / 10;
      trend = trendOf(pct);
    }
    lifts.push({ exerciseId: ex.id, name: ex.name, metric, sessions: points.length, counts, points, change, pct, trend });
  }
  lifts.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));

  const counted = lifts.filter((l) => l.trend !== null);
  const stronger = counted.filter((l) => l.trend === "up" || l.trend === "up-a-lot").length;
  // "Average est. 1RM" means it: loaded external lifts only (added-load bodyweight percentages run huge, reps aren't 1RM).
  const kinds = new Map(doc.exercises.map((e) => [e.id, e.loadKind]));
  const loaded = counted.filter((l) => l.metric === "e1rm" && kinds.get(l.exerciseId) === "external");
  const avgPct = loaded.length ? Math.round(loaded.reduce((a, l) => a + l.pct!, 0) / loaded.length) : null;

  const attention = counted
    .filter((l) => l.trend === "down" || l.trend === "flat")
    .sort((a, b) => (a.trend === b.trend ? 0 : a.trend === "down" ? -1 : 1) || a.pct! - b.pct! || a.name.localeCompare(b.name))
    .slice(0, ATTENTION_MAX)
    .map((l) => explain(doc, l, today)!);

  return { stronger, counted: counted.length, avgPct, lifts, attention };
}
