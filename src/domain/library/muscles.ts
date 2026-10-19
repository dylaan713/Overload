import type { Muscle } from "../types";

export type Region = "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest", "front-delts": "Front delts", "side-delts": "Side delts", "rear-delts": "Rear delts",
  lats: "Lats", "upper-back": "Upper back", traps: "Traps", "lower-back": "Lower back",
  biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", obliques: "Obliques",
  quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", adductors: "Adductors", abductors: "Abductors", calves: "Calves",
};

export const REGION_OF: Record<Muscle, Region> = {
  chest: "Chest",
  lats: "Back", "upper-back": "Back", traps: "Back", "lower-back": "Back",
  "front-delts": "Shoulders", "side-delts": "Shoulders", "rear-delts": "Shoulders",
  biceps: "Arms", triceps: "Arms", forearms: "Arms",
  quads: "Legs", hamstrings: "Legs", glutes: "Legs", adductors: "Legs", abductors: "Legs", calves: "Legs",
  abs: "Core", obliques: "Core",
};

/** Words people search with, per muscle (label words included). A search word matches the start of any of these. */
const MUSCLE_TERMS: Record<Muscle, string[]> = {
  chest: ["chest", "pecs", "pectorals"],
  "front-delts": ["front delts", "anterior", "shoulders"],
  "side-delts": ["side delts", "lateral", "shoulders"],
  "rear-delts": ["rear delts", "posterior", "shoulders"],
  lats: ["lats", "latissimus", "back"],
  "upper-back": ["upper back", "rhomboids"],
  traps: ["traps", "trapezius", "back"],
  "lower-back": ["lower back", "erectors"],
  biceps: ["biceps", "arms"],
  triceps: ["triceps", "arms"],
  forearms: ["forearms", "grip", "arms"],
  abs: ["abs", "abdominals", "core"],
  obliques: ["obliques", "core"],
  quads: ["quads", "quadriceps", "thighs", "legs"],
  hamstrings: ["hamstrings", "hams", "legs"],
  glutes: ["glutes", "butt", "legs"],
  adductors: ["adductors", "inner thighs", "legs"],
  abductors: ["abductors", "outer thighs", "legs"],
  calves: ["calves", "calf", "legs"],
};

const MUSCLE_WORDS = Object.fromEntries(
  Object.entries(MUSCLE_TERMS).map(([m, terms]) => [m, terms.flatMap((t) => t.split(" "))]),
) as Record<Muscle, string[]>;

/** Muscles a search word names: "bicep" → biceps, "delt" → all three delts. Under 3 letters names none. */
export function musclesForWord(word: string): Muscle[] {
  const w = word.toLowerCase();
  if (w.length < 3) return [];
  return (Object.keys(MUSCLE_WORDS) as Muscle[]).filter((m) => MUSCLE_WORDS[m].some((t) => t.startsWith(w)));
}
