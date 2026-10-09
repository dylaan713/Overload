export type Unit = "lb" | "kg";
export type ExerciseType = "compound" | "isolation";

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
}

export interface SetEntry {
  weight: number;
  reps: number;
  warmup: boolean;
  rpe?: number; // reserved for sub-project 5; no UI uses it yet
}

export interface Block {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD, local calendar day
  name: string;
  blocks: Block[];
}

/** One exercise's work on one day (a flattened Block). */
export interface Entry {
  id: string;
  date: string;
  sessionName: string;
  exerciseId: string;
  sets: SetEntry[];
}

export interface TypeSettings {
  sets: number;
  repBottom: number;
  repTop: number;
  warmupSets: number;
}

export interface Settings {
  unit: Unit;
  increment: number;
  compound: TypeSettings;
  isolation: TypeSettings;
  restTimer: { defaultSeconds: number };
  theme: string;
}

/** Reserved for sub-project 4. */
export interface Program {
  id: string;
  name: string;
}

export interface StoreDoc {
  schemaVersion: 2;
  exercises: Exercise[];
  sessions: Session[];
  customGroups: string[];
  settings: Settings;
  programs: Program[];
}
