export type Unit = "lb" | "kg";

export const EQUIPMENT = [
  "barbell", "dumbbell", "machine", "cable", "smith", "ez-bar", "trap-bar", "kettlebell", "bodyweight", "band", "plate",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLES = [
  "chest", "front-delts", "side-delts", "rear-delts", "lats", "upper-back", "traps", "lower-back",
  "biceps", "triceps", "forearms", "abs", "obliques",
  "quads", "hamstrings", "glutes", "adductors", "abductors", "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type LiftClass = "compound" | "isolation";
/** external = load on the bar/stack; bodyweight = weight is added load; assisted = weight is assistance (higher is easier). */
export type LoadKind = "external" | "bodyweight" | "assisted";

export interface Exercise {
  id: string;
  libraryId: string | null; // null = custom exercise
  name: string;
  equipment: Equipment;
  primary: Muscle[]; // ≥ 1
  secondary: Muscle[];
  class: LiftClass;
  loadKind: LoadKind;
  step: number | null; // per-exercise step override in the user's unit; null = equipment default
  archived: boolean;
}

export type Rir = 0 | 1 | 2 | 3 | 4; // 4 = "4+"

export interface SetEntry {
  weight: number;
  reps: number;
  warmup: boolean;
  rir: Rir | null; // null = not rated
  /** Set by a unit switch: the weight as logged, so switching back restores it exactly. Editing the weight clears it. */
  orig?: { weight: number; unit: Unit };
}

export interface Block {
  id: string;
  exerciseId: string;
  test: boolean; // powerlifting test day
  sets: SetEntry[];
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD, local calendar day
  name: string;
  blocks: Block[];
}

export type Style = "strength" | "hypertrophy";

export interface Phase {
  id: string;
  style: Style;
  startDate: string; // current phase = latest startDate ≤ today
}

export interface ClassRules {
  repLow: number;
  repHigh: number;
  sets: number;
  rirLow: number;
  rirHigh: number;
  restSeconds: number;
  warmupSets: number;
}

export interface StyleRules {
  compound: ClassRules;
  isolation: ClassRules;
  volume: { low: number; high: number };
}

export type ThemePref = "system" | "dark" | "light";

export interface Settings {
  unit: Unit;
  phases: Phase[];
  styles: Record<Style, StyleRules>;
  equipmentSteps: Record<Equipment, number>;
  theme: ThemePref;
}

/** Reserved for the programs sub-project. */
export interface Program {
  id: string;
  name: string;
}

export interface FatigueDecision {
  weekStart: string;
  status: "accepted" | "dismissed";
  decidedOn: string;
}

export interface StoreDoc {
  schemaVersion: 2;
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
  programs: Program[];
  coaching: { fatigueWeeks: FatigueDecision[] };
}
