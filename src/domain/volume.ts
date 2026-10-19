import { addDays, weekStart } from "./dates";
import { fatigueActive } from "./engine/fatigue";
import { MUSCLE_LABEL, REGION_OF } from "./library/muscles";
import { phaseOf } from "./settings";
import type { Muscle, SetEntry, StoreDoc } from "./types";

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
 * How much one working set counts toward weekly volume. Growth comes from sets taken near failure, so an Easy set
 * (4+ reps left) counts half; unrated sets count in full so skipping the rating isn't punished.
 */
export function setCredit(s: SetEntry): number {
  if (s.warmup) return 0;
  return s.rir !== null && s.rir >= 4 ? 0.5 : 1;
}

/**
 * Effective sets per muscle this Sunday–Saturday week, against the current style's range (halved in an accepted
 * lighter week, matching the engine's half sets). Test singles don't count. Only muscles trained in the last
 * 4 weeks are listed, so muscles the user never trains don't nag.
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
      const working = b.test ? 0 : b.sets.reduce((a, x) => a + setCredit(x), 0);
      if (working === 0) continue;
      for (const m of [...ex.primary, ...ex.secondary]) recent.add(m);
      if (s.date < from) continue;
      for (const m of ex.primary) count.set(m, (count.get(m) ?? 0) + working * PRIMARY);
      for (const m of ex.secondary) count.set(m, (count.get(m) ?? 0) + working * SECONDARY);
    }
  }

  const range = doc.settings.styles[phaseOf(doc.settings, today).style].volume;
  const light = fatigueActive(doc, today);
  const low = light ? Math.ceil(range.low / 2) : range.low;
  const high = light ? Math.ceil(range.high / 2) : range.high;
  const rows: VolumeRow[] = [...recent].map((muscle) => {
    const sets = count.get(muscle) ?? 0;
    const label = MUSCLE_LABEL[muscle];
    const status = sets < low ? "under" : sets > high ? "over" : "in";
    const suggestion =
      status === "under" ? `${label}: ${fmt(sets)} of ${low}–${high} this week — add ${Math.ceil(low - sets)}`
      : status === "over" ? `${label}: ${fmt(sets)}, above ${high}`
      : null;
    return { muscle, label, region: REGION_OF[muscle], sets, low, high, status, suggestion };
  });

  const rank = { under: 0, over: 1, in: 2 } as const;
  const gap = (r: VolumeRow) => (r.status === "under" ? r.low - r.sets : r.status === "over" ? r.sets - r.high : 0);
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || gap(b) - gap(a) || a.label.localeCompare(b.label));
}
