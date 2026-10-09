import type { Entry, Exercise, Session } from "./types";

export function buildEntries(sessions: Session[]): Entry[] {
  return sessions.flatMap((s) =>
    s.blocks.map((b) => ({ id: b.id, date: s.date, sessionName: s.name, exerciseId: b.exerciseId, sets: b.sets })),
  );
}

export function entriesByExercise(exercises: Exercise[], sessions: Session[]): Record<string, Entry[]> {
  const map: Record<string, Entry[]> = {};
  exercises.forEach((e) => (map[e.id] = []));
  buildEntries(sessions).forEach((entry) => {
    (map[entry.exerciseId] ??= []).push(entry);
  });
  Object.values(map).forEach((arr) => arr.sort((a, b) => (a.date < b.date ? 1 : -1)));
  return map;
}
