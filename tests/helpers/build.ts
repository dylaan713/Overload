import { emptyDoc } from "../../src/data/store";
import type { Exercise, Phase, Session, SetEntry, StoreDoc, Style, Unit } from "../../src/domain/types";
import { EQUIPMENT_STEPS } from "../../src/domain/settings";

// Tiny builders for hand-written histories. Keep them dumb: tests should read like data.

export function ex(id: string, o: Partial<Exercise> = {}): Exercise {
  return {
    id, libraryId: null, name: id, equipment: "barbell", primary: ["chest"], secondary: [],
    class: "compound", loadKind: "external", step: null, archived: false, ...o,
  };
}

export function sets(weight: number, reps: number[], rir: (number | null)[] = []): SetEntry[] {
  return reps.map((r, i) => ({ weight, reps: r, warmup: false, rir: (rir[i] ?? null) as SetEntry["rir"] }));
}

export function warm(weight: number, reps: number): SetEntry {
  return { weight, reps, warmup: true, rir: null };
}

export function day(date: string, blocks: [exerciseId: string, sets: SetEntry[], test?: boolean][]): Session {
  return {
    id: `s-${date}`, date, name: "",
    blocks: blocks.map(([exerciseId, s, test], i) => ({ id: `b-${date}-${i}`, exerciseId, test: test ?? false, sets: s })),
  };
}

export function doc(o: { exercises?: Exercise[]; sessions?: Session[]; style?: Style; phases?: Phase[]; unit?: Unit; today?: string } = {}): StoreDoc {
  const d = emptyDoc(o.today ?? "2026-09-01");
  if (o.unit) {
    d.settings.unit = o.unit;
    d.settings.equipmentSteps = { ...EQUIPMENT_STEPS[o.unit] };
  }
  if (o.style) d.settings.phases = [{ id: "p-style", style: o.style, startDate: "2026-01-01" }];
  if (o.phases) d.settings.phases = o.phases;
  d.exercises = o.exercises ?? [];
  d.sessions = o.sessions ?? [];
  return d;
}
