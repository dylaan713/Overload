import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Exercise, ExerciseType, Session, SetEntry, Settings } from "../../src/domain/types";

export interface BackupV1 {
  app: "overload";
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  sessions: Session[];
  customGroups: string[];
  settings: Settings;
}

type Day = [number, number][] | "warmup-only";
interface Script {
  id: string;
  name: string;
  type: ExerciseType;
  group: string;
  warm?: SetEntry[];
  days: Day[];
}

const w = (weight: number, reps: number): SetEntry => ({ weight, reps, warmup: true });
const work = (weight: number, reps: number): SetEntry => ({ weight, reps, warmup: false });

// Scripted (not random) so every engine branch is guaranteed to be exercised.
const SCRIPTS: Script[] = [
  {
    id: "ex-stall", name: "Stall Press", type: "compound", group: "Shoulders",
    days: Array.from({ length: 6 }, () => [[100, 6], [100, 6]] as [number, number][]),
  },
  {
    id: "ex-ramp", name: "Ramp Squat", type: "compound", group: "Legs", warm: [w(45, 8), w(95, 5)],
    days: [
      [[135, 6], [135, 6]], [[135, 7], [135, 6]], [[135, 8], [135, 8]],
      [[140, 6], [140, 6]], [[140, 5], [140, 4]], [[135, 7], [135, 7]],
    ],
  },
  { id: "ex-blow", name: "Blowout Row", type: "compound", group: "Back", days: [[[50, 11], [50, 11]], [[55, 6], [55, 7]]] },
  { id: "ex-iso", name: "Curl", type: "isolation", group: "Arms", days: [[[30, 8], [30, 9]], [[30, 10], [30, 10]], [[35, 8], [35, 8]]] },
  { id: "ex-warm", name: "Warm-only Day", type: "compound", group: "Back", warm: [w(45, 8)], days: [[[95, 7], [95, 7]], "warmup-only"] },
];

export function syntheticBackup(): BackupV1 {
  const exercises: Exercise[] = SCRIPTS.map((s) => ({ id: s.id, name: s.name, type: s.type, muscleGroup: s.group }));
  const sessions: Session[] = [];
  for (let d = 0; d < 6; d++) {
    const blocks = SCRIPTS.flatMap((s) => {
      const day = s.days[d];
      if (!day) return [];
      const sets = day === "warmup-only" ? [...(s.warm ?? [])] : [...(s.warm ?? []), ...day.map(([wt, r]) => work(wt, r))];
      return [{ id: `${s.id}-${d}`, exerciseId: s.id, sets }];
    });
    sessions.push({ id: `s-${d}`, date: `2026-03-${String(d * 2 + 1).padStart(2, "0")}`, name: `Day ${d + 1}`, blocks });
  }
  return {
    app: "overload", version: 1, exportedAt: "2026-03-12T00:00:00.000Z",
    exercises, sessions, customGroups: ["Neck"], settings: structuredClone(DEFAULT_SETTINGS),
  };
}

/** Synthetic always; real personal backups only when present (gitignored). */
export function loadBackups(): { name: string; backup: BackupV1 }[] {
  const list = [{ name: "synthetic", backup: syntheticBackup() }];
  const real: [string, string][] = [
    ["real-oct", "fixtures/real-backup.json"],
    ["real-aug", "fixtures/real-backup-aug.json"],
  ];
  for (const [name, file] of real) {
    const p = resolve(process.cwd(), file);
    if (existsSync(p)) list.push({ name, backup: JSON.parse(readFileSync(p, "utf8")) as BackupV1 });
  }
  return list;
}
