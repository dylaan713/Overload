import type { Equipment, Exercise, LiftClass, Muscle } from "../types";
import { LIBRARY, type LibraryExercise } from "./catalog";

export { LIBRARY, type LibraryExercise } from "./catalog";

/** Case-insensitive; every whitespace-separated token must appear in the name, movement or an alias. */
export function searchLibrary(query: string): LibraryExercise[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return LIBRARY.filter((e) => {
    const hay = [e.name, e.movement, ...e.aliases].join("\n").toLowerCase();
    return tokens.every((t) => hay.includes(t));
  }).sort((a, b) => a.movement.localeCompare(b.movement) || a.name.localeCompare(b.name));
}

// Library fields are copied, so a later library update never rewrites a user's history.
export function exerciseFromLibrary(entry: LibraryExercise, id: string): Exercise {
  return {
    id, libraryId: entry.id, name: entry.name, equipment: entry.equipment, primary: [...entry.primary],
    secondary: [...entry.secondary], class: entry.class, loadKind: entry.loadKind, step: null, archived: false,
  };
}

export function customExercise(
  input: { name: string; equipment: Equipment; primary: Muscle[]; secondary?: Muscle[]; class: LiftClass; step?: number | null },
  id: string,
): Exercise | { error: string } {
  const name = input.name.trim();
  if (!name) return { error: "Name can't be empty" };
  if (input.primary.length === 0) return { error: "Pick at least one muscle worked" };
  const step = input.step ?? null;
  if (step !== null && !(step > 0)) return { error: "Step must be more than 0" };
  return {
    id, libraryId: null, name, equipment: input.equipment, primary: [...input.primary],
    secondary: (input.secondary ?? []).filter((m) => !input.primary.includes(m)),
    class: input.class, loadKind: input.equipment === "bodyweight" ? "bodyweight" : "external", step, archived: false,
  };
}
