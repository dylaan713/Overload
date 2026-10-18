import { REGION_OF, type Region } from "./library/muscles";
import type { Exercise, StoreDoc } from "./types";

export const REGIONS: readonly Region[] = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];

export const regionOf = (ex: Exercise): Region => REGION_OF[ex.primary[0]!];

/** Non-empty regions in REGIONS order, names sorted. Archived exercises are listed only with `archived: true`. */
export function groupByRegion(exercises: Exercise[], opts: { archived?: boolean } = {}): { region: Region; exercises: Exercise[] }[] {
  const wanted = exercises.filter((e) => e.archived === (opts.archived ?? false));
  return REGIONS.map((region) => ({
    region,
    exercises: wanted.filter((e) => regionOf(e) === region).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.exercises.length > 0);
}

/** Logged sessions that include the exercise (what a permanent delete would touch). */
export function sessionsWithExercise(doc: StoreDoc, id: string): number {
  return doc.sessions.filter((s) => s.blocks.some((b) => b.exerciseId === id)).length;
}

/** Removes the exercise, its blocks, and any session left with no blocks. */
export function deleteExerciseCascade(doc: StoreDoc, id: string): StoreDoc {
  return {
    ...doc,
    exercises: doc.exercises.filter((e) => e.id !== id),
    sessions: doc.sessions
      .map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.exerciseId !== id) }))
      .filter((s) => s.blocks.length > 0),
  };
}

export type LibraryState = { status: "new" } | { status: "added" | "archived"; exerciseId: string };

/** Whether a library entry is already in My exercises, so adding it again restores instead of duplicating. */
export function libraryState(doc: StoreDoc, libraryId: string): LibraryState {
  const found = doc.exercises.find((e) => e.libraryId === libraryId);
  if (!found) return { status: "new" };
  return { status: found.archived ? "archived" : "added", exerciseId: found.id };
}
