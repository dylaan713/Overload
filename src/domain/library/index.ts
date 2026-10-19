import type { Equipment, Exercise, LiftClass, LoadKind, Muscle } from "../types";
import { EQUIPMENT_LABEL, LIBRARY, type LibraryExercise } from "./catalog";
import { musclesForWord } from "./muscles";

export { LIBRARY, type LibraryExercise } from "./catalog";

/**
 * Case-insensitive; every whitespace-separated token must appear in one of `texts` or name a muscle the
 * exercise mainly works ("bicep", "pecs", "delt"), so "biceps cable" finds cable curls.
 */
export function matchesSearch(query: string, texts: string[], primary: Muscle[]): boolean {
  const hay = texts.join("\n").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t) || musclesForWord(t).some((m) => primary.includes(m)));
}

export function searchLibrary(query: string): LibraryExercise[] {
  return LIBRARY.filter((e) => matchesSearch(query, [e.name, e.movement, ...e.aliases], e.primary)).sort((a, b) => a.movement.localeCompare(b.movement) || a.name.localeCompare(b.name));
}

// Library fields are copied, so a later library update never rewrites a user's history.
export function exerciseFromLibrary(entry: LibraryExercise, id: string): Exercise {
  return {
    id, libraryId: entry.id, name: entry.name, equipment: entry.equipment, primary: [...entry.primary],
    secondary: [...entry.secondary], class: entry.class, loadKind: entry.loadKind, step: null, archived: false,
  };
}

export const equipmentLabel = (e: Equipment): string => EQUIPMENT_LABEL[e];

/** Search results grouped by movement, in order of first appearance (one row per movement, then pick equipment). */
export function groupByMovement(entries: LibraryExercise[]): { movement: string; entries: LibraryExercise[] }[] {
  const groups = new Map<string, LibraryExercise[]>();
  for (const e of entries) groups.set(e.movement, [...(groups.get(e.movement) ?? []), e]);
  return [...groups].map(([movement, list]) => ({ movement, entries: list }));
}

/** The validation shared by "Create your own" and editing an exercise. */
export function exerciseError(input: { name: string; primary: Muscle[]; step?: number | null }): string | null {
  if (!input.name.trim()) return "Name can't be empty";
  if (input.primary.length === 0) return "Pick at least one muscle worked";
  const step = input.step ?? null;
  if (step !== null && !(step > 0)) return "Step must be more than 0";
  return null;
}

/** How a custom exercise is loaded follows its equipment. */
export const customLoadKind = (equipment: Equipment): LoadKind => (equipment === "bodyweight" ? "bodyweight" : "external");

export function customExercise(
  input: { name: string; equipment: Equipment; primary: Muscle[]; secondary?: Muscle[]; class: LiftClass; step?: number | null },
  id: string,
): Exercise | { error: string } {
  const error = exerciseError(input);
  if (error) return { error };
  const name = input.name.trim();
  const step = input.step ?? null;
  return {
    id, libraryId: null, name, equipment: input.equipment, primary: [...input.primary],
    secondary: (input.secondary ?? []).filter((m) => !input.primary.includes(m)),
    class: input.class, loadKind: customLoadKind(input.equipment), step, archived: false,
  };
}
