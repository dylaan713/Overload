import { addDays, weekStart } from "./dates";
import { MUSCLE_LABEL, REGION_OF } from "./library/muscles";
import { phaseOf } from "./settings";
import type { Muscle, StoreDoc } from "./types";

export interface VolumeRow {
  muscle: Muscle;
  label: string;
  region: string;
  sets: number;
  low: number;
  high: number;
  status: "under" | "in" | "over";
  suggestion: string | null;
}

const PRIMARY = 1;
const SECONDARY = 0.5;
const RECENT_DAYS = 28;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Working sets per muscle this Sunday–Saturday week (test sets included), against the current style's range.
 * Only muscles trained in the last 4 weeks are listed, so muscles the user never trains don't nag.
 */
export function weeklyVolume(doc: StoreDoc, today: string): VolumeRow[] {
  const from = weekStart(today);
  const recentFrom = addDays(today, -(RECENT_DAYS - 1));
  const exercises = new Map(doc.exercises.map((e) => [e.id, e]));
  const count = new Map<Muscle, number>();
  const recent = new Set<Muscle>();

  for (const s of doc.sessions) {
    if (s.date > today || s.date < recentFrom) continue;
    for (const b of s.blocks) {
      const ex = exercises.get(b.exerciseId);
      if (!ex) continue;
      const working = b.sets.filter((x) => !x.warmup).length;
      if (working === 0) continue;
      for (const m of [...ex.primary, ...ex.secondary]) recent.add(m);
      if (s.date < from) continue;
      for (const m of ex.primary) count.set(m, (count.get(m) ?? 0) + working * PRIMARY);
      for (const m of ex.secondary) count.set(m, (count.get(m) ?? 0) + working * SECONDARY);
    }
  }

  const { low, high } = doc.settings.styles[phaseOf(doc.settings, today).style].volume;
  const rows: VolumeRow[] = [...recent].map((muscle) => {
    const sets = count.get(muscle) ?? 0;
    const label = MUSCLE_LABEL[muscle];
    const status = sets < low ? "under" : sets > high ? "over" : "in";
    const suggestion =
      status === "under" ? `${label}: ${fmt(sets)} of ${low}–${high} this week — add ${Math.ceil(low - sets)}`
      : status === "over" ? `${label}: ${fmt(sets)}, above ${high} — consider fewer next week`
      : null;
    return { muscle, label, region: REGION_OF[muscle], sets, low, high, status, suggestion };
  });

  const rank = { under: 0, over: 1, in: 2 } as const;
  const gap = (r: VolumeRow) => (r.status === "under" ? r.low - r.sets : r.status === "over" ? r.sets - r.high : 0);
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || gap(b) - gap(a) || a.label.localeCompare(b.label));
}
