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
