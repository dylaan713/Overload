import { MUSCLE_LABEL } from "./library/muscles";
import type { Muscle, StoreDoc } from "./types";

const TOP_MUSCLES = 3;

const trained = (doc: StoreDoc) => doc.sessions.filter((s) => s.blocks.some((b) => b.sets.length > 0));

/** Dates with any logged set. */
export function trainingDays(doc: StoreDoc): Set<string> {
  return new Set(trained(doc).map((s) => s.date));
}

export function latestTrainingDay(doc: StoreDoc, today: string): string | null {
  return trained(doc).map((s) => s.date).filter((d) => d <= today).sort().at(-1) ?? null;
}

export interface DaySummary { date: string; muscles: string[]; exerciseCount: number }

/** What a day was, at a glance: its top muscles by working sets (primary only) and how many exercises. */
export function daySummary(doc: StoreDoc, date: string): DaySummary | null {
  const session = trained(doc).find((s) => s.date === date);
  if (!session) return null;
  const exercises = new Map(doc.exercises.map((e) => [e.id, e]));
  const count = new Map<Muscle, number>();
  const ids = new Set<string>();
  for (const b of session.blocks) {
    if (b.sets.length === 0) continue;
    ids.add(b.exerciseId);
    const n = b.sets.filter((s) => !s.warmup).length;
    for (const m of exercises.get(b.exerciseId)?.primary ?? []) count.set(m, (count.get(m) ?? 0) + n);
  }
  const muscles = [...count.entries()]
    .filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => y - x || MUSCLE_LABEL[a].localeCompare(MUSCLE_LABEL[b]))
    .slice(0, TOP_MUSCLES)
    .map(([m]) => MUSCLE_LABEL[m]);
  return { date, muscles, exerciseCount: ids.size };
}

/** A past workout's exercises in order, for today's Log: archived ones skipped, ones already logged on the day left out. */
export function repeatQueue(doc: StoreDoc, fromDate: string, logDay: string): { ids: string[]; skipped: number } {
  const exercises = new Map(doc.exercises.map((e) => [e.id, e]));
  const done = new Set(doc.sessions.filter((s) => s.date === logDay).flatMap((s) => s.blocks.filter((b) => b.sets.length).map((b) => b.exerciseId)));
  const ids: string[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const b of doc.sessions.find((s) => s.date === fromDate)?.blocks ?? []) {
    if (seen.has(b.exerciseId) || b.sets.length === 0) continue;
    seen.add(b.exerciseId);
    const ex = exercises.get(b.exerciseId);
    if (!ex) continue;
    if (ex.archived) skipped++;
    else if (!done.has(b.exerciseId)) ids.push(b.exerciseId);
  }
  return { ids, skipped };
}
