# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tested TypeScript foundation for the Overload rewrite: versioned data store, lossless legacy migration, backup import/export, and a pure training engine proven identical to the current one.

**Architecture:** Pure domain code in `src/domain` (types, settings, progression, warm-ups, e1RM, entry grouping) with no React or storage. A data layer in `src/data` behind a tiny async key-value adapter (normalize/validate → v2 document → boot/migrate → backups). The legacy `src/App.jsx` stays the shipping UI; a read-only dev page proves the migration against real browser storage. Golden tests execute a verbatim copy of the old engine and the new engine on the same real data and require identical output.

**Tech Stack:** TypeScript (strict), Vitest, Vite 6 (existing), React 19 (existing, unused by this plan), ESLint + typescript-eslint.

**Spec:** `docs/superpowers/specs/2026-10-09-foundation-design.md`

**Spec deviation (decided while planning):** the dev page runs migration as a **dry run** (`persist: false`) and has **no import**. If it wrote `overload.v2` while the legacy UI still logs to the legacy keys, `overload.v2` would go stale and the real app would later ignore newer data. The real, persisting migration happens on first launch of the new UI (sub-project 2).

## Global Constraints

- Legacy localStorage keys `exercises`, `sessions`, `customGroups`, `settings` are **never written or deleted** by any code in this plan.
- New store key is exactly `overload.v2`; document has `schemaVersion: 2`.
- Backup files: write `{app:"overload", version:2, ...}`; read `version` 1 and 2 forever.
- Engine behavior must match `main:src/App.jsx` exactly (constants `STALL_SESSIONS=3`, `BLOWOUT_MARGIN=3`, `DELOAD_PCT=0.9`).
- TypeScript `strict`; no `any` in `src/`.
- `fixtures/` (personal data) stays gitignored; tests must pass without it using the synthetic fixture.
- Work on branch `rewrite`; do not touch `main`.
- Gate for every task: `npm test && npm run typecheck && npm run lint` all pass before commit.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (shown below as the second `-m`).

## Review Focus

Failure modes the spec implies that most need an explicit test (each is pinned in the named task):
1. **Corrupt `overload.v2` must not fall back to re-migrating legacy** (that would silently overwrite newer data with older) — Task 5.
2. **Dry-run boot (`persist:false`) writes nothing**, and migrating twice is idempotent — Task 5.
3. **Malformed legacy values**: numeric strings, NaN, negative weights, missing `warmup`, bad dates — Task 4.
4. **Sessions referencing a deleted exercise** are kept and warned about, never dropped — Task 4.
5. **Storage write failure (quota)** rejects instead of reporting success; **invalid backup import leaves the existing store untouched** — Tasks 4 and 6.

## File Structure

```
src/domain/types.ts        shared types (Exercise, SetEntry, Session, Entry, Settings, StoreDoc, ...)
src/domain/settings.ts     DEFAULT_SETTINGS, mergeSettings, plateIncrement
src/domain/strength.ts     e1rm
src/domain/warmup.ts       getWarmupSets
src/domain/entries.ts      buildEntries, entriesByExercise
src/domain/progression.ts  constants, Suggestion, getSuggestion, getSuggestedTargetWeight
src/data/kv.ts             KeyValueStore, createLocalStorageKV, createMemoryKV
src/data/normalize.ts      DataError, normalizers, validateDoc
src/data/store.ts          V2_KEY, emptyDoc, loadDoc, saveDoc
src/data/migrate.ts        LEGACY_KEYS, readLegacy, legacyToDoc
src/data/boot.ts           bootStore, dumpLegacyRaw
src/data/backup.ts         exportBackup, parseBackup, importBackup
src/dev/main.ts + dev.html read-only dry-run page
tests/reference/legacyEngine.js   verbatim old engine (test-only)
tests/helpers/fixtures.ts         synthetic + real fixture loader
tests/domain/*.test.ts, tests/data/*.test.ts, tests/golden/engine.golden.test.ts
```

---

### Task 1: Tooling, types and settings

**Files:**
- Create: `tsconfig.json`, `src/domain/types.ts`, `src/domain/settings.ts`, `tests/domain/settings.test.ts`
- Modify: `package.json` (scripts + devDependencies), `vite.config.js` (add `test` block), `eslint.config.js`, `.gitignore`

**Interfaces:**
- Produces: `Settings`, `TypeSettings`, `Unit`, `ExerciseType`, `Exercise`, `SetEntry`, `Block`, `Session`, `Entry`, `Program`, `StoreDoc` (from `types.ts`); `DEFAULT_SETTINGS: Settings`, `mergeSettings(stored: unknown): Settings`, `plateIncrement(unit: Unit): number` (from `settings.ts`).

- [ ] **Step 1: Install tooling**

Run: `npm install -D typescript@~5.8 vitest@^3 typescript-eslint@^8 @types/node`
Expected: installs without peer-dependency errors.

- [ ] **Step 2: Add scripts to `package.json`**

In `"scripts"` add:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowJs": true,
    "checkJs": false,
    "types": ["node"]
  },
  "include": ["src/domain", "src/data", "src/dev", "tests"]
}
```

- [ ] **Step 4: Add Vitest config to `vite.config.js`**

Inside `defineConfig({ ... })`, next to `base: './'`, add:
```js
  test: {
    include: ['tests/**/*.test.ts'],
  },
```

- [ ] **Step 5: Extend `eslint.config.js` for TypeScript**

Add `import tseslint from 'typescript-eslint'` at the top. Change the ignores entry to
`{ ignores: ['dist', 'fixtures', 'tests/reference'] }`. Append to the exported array:
```js
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
```

- [ ] **Step 6: Fix `.gitignore` so only the root `fixtures/` is ignored**

Replace the line `fixtures/` with `/fixtures/` (the unanchored pattern would also ignore `tests/helpers`-adjacent fixture folders).

- [ ] **Step 7: Write the failing test `tests/domain/settings.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, plateIncrement } from "../../src/domain/settings";

describe("mergeSettings", () => {
  it("returns a fresh copy of defaults for null/non-object input", () => {
    const a = mergeSettings(null);
    expect(a).toEqual(DEFAULT_SETTINGS);
    expect(a).not.toBe(DEFAULT_SETTINGS);
    expect(a.compound).not.toBe(DEFAULT_SETTINGS.compound);
    expect(mergeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial nested settings over defaults", () => {
    const s = mergeSettings({ unit: "kg", compound: { sets: 3 }, restTimer: {} });
    expect(s.unit).toBe("kg");
    expect(s.compound).toEqual({ sets: 3, repBottom: 6, repTop: 8, warmupSets: 2 });
    expect(s.isolation).toEqual(DEFAULT_SETTINGS.isolation);
    expect(s.restTimer.defaultSeconds).toBe(120);
  });
});

describe("plateIncrement", () => {
  it("is 2.5 for kg and 5 for lb", () => {
    expect(plateIncrement("kg")).toBe(2.5);
    expect(plateIncrement("lb")).toBe(5);
  });
});
```

- [ ] **Step 8: Run it and confirm it fails**

Run: `npx vitest run tests/domain/settings.test.ts`
Expected: FAIL, cannot resolve `../../src/domain/settings`.

- [ ] **Step 9: Create `src/domain/types.ts`**

```ts
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
```

- [ ] **Step 10: Create `src/domain/settings.ts`**

```ts
import type { Settings, Unit } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  unit: "lb",
  increment: 5, // amount added on an increase, in the current unit
  compound: { sets: 2, repBottom: 6, repTop: 8, warmupSets: 2 },
  isolation: { sets: 2, repBottom: 8, repTop: 10, warmupSets: 1 },
  restTimer: { defaultSeconds: 120 },
  theme: "ember",
};

// Merge stored settings over defaults so older/partial saves don't break.
export function mergeSettings(stored: unknown): Settings {
  if (!stored || typeof stored !== "object") return structuredClone(DEFAULT_SETTINGS);
  const s = stored as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    compound: { ...DEFAULT_SETTINGS.compound, ...(s.compound || {}) },
    isolation: { ...DEFAULT_SETTINGS.isolation, ...(s.isolation || {}) },
    restTimer: { ...DEFAULT_SETTINGS.restTimer, ...(s.restTimer || {}) },
  };
}

export function plateIncrement(unit: Unit): number {
  return unit === "kg" ? 2.5 : 5;
}
```

- [ ] **Step 11: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 3 tests pass; typecheck and lint clean (lint also still passes on `src/App.jsx`).

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "build: add TypeScript, Vitest and domain types/settings" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reference engine, fixtures, e1RM, warm-ups, entry grouping

**Files:**
- Create: `tests/reference/legacyEngine.js`, `tests/helpers/fixtures.ts`, `src/domain/strength.ts`, `src/domain/warmup.ts`, `src/domain/entries.ts`, `tests/domain/strength.test.ts`, `tests/domain/warmup.test.ts`, `tests/domain/entries.test.ts`

**Interfaces:**
- Consumes: types and `plateIncrement` from Task 1.
- Produces:
  - `e1rm(weight: number, reps: number): number`
  - `getWarmupSets(type: ExerciseType, targetWeight: number | null | undefined, settings: Settings): { weight: number; reps: number }[]`
  - `buildEntries(sessions: Session[]): Entry[]`
  - `entriesByExercise(exercises: Exercise[], sessions: Session[]): Record<string, Entry[]>` (each list newest-first)
  - Test helpers: `BackupV1` type, `syntheticBackup(): BackupV1`, `loadBackups(): { name: string; backup: BackupV1 }[]` (synthetic always; real Oct/Aug files from `fixtures/` when present).

- [ ] **Step 1: Generate the verbatim reference engine from `main`**

```bash
mkdir -p tests/reference
{
  echo '// Verbatim copy of the pre-rewrite engine from main:src/App.jsx (lines 36-58, 190-200, 218-330).'
  echo '// Test-only reference for golden tests. Do not edit; do not import from app code.'
  git show main:src/App.jsx | sed -n '36,58p;190,200p;218,330p'
  echo 'export { DEFAULT_SETTINGS, mergeSettings, plateIncrement, e1rm, getWarmupSets, getSuggestion };'
} > tests/reference/legacyEngine.js
node --input-type=module -e "import('./tests/reference/legacyEngine.js').then(m=>console.log(Object.keys(m).join(',')))"
```
Expected output: `DEFAULT_SETTINGS,e1rm,getSuggestion,getWarmupSets,mergeSettings,plateIncrement`. If it errors, a line range drifted — re-check the ranges against `git show main:src/App.jsx | sed -n '36,58p'` etc. before continuing.

- [ ] **Step 2: Create `tests/helpers/fixtures.ts`**

```ts
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
```

- [ ] **Step 3: Write failing tests**

`tests/domain/strength.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { e1rm } from "../../src/domain/strength";
import * as ref from "../reference/legacyEngine.js";

describe("e1rm", () => {
  it("applies Epley and rounds", () => {
    expect(e1rm(100, 10)).toBe(133);
    expect(e1rm(135, 8)).toBe(171);
  });
  it("returns 0 for missing or non-positive inputs", () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
    expect(e1rm(100, -3)).toBe(0);
  });
  it("matches the legacy engine across a grid", () => {
    for (let weight = 0; weight <= 500; weight += 2.5) {
      for (let reps = -1; reps <= 30; reps++) expect(e1rm(weight, reps)).toBe(ref.e1rm(weight, reps));
    }
  });
});
```

`tests/domain/warmup.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getWarmupSets } from "../../src/domain/warmup";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Settings } from "../../src/domain/types";
import * as ref from "../reference/legacyEngine.js";

describe("getWarmupSets", () => {
  it("ramps toward the working weight (lb, 2 sets)", () => {
    expect(getWarmupSets("compound", 200, DEFAULT_SETTINGS)).toEqual([
      { weight: 90, reps: 8 },
      { weight: 180, reps: 3 },
    ]);
  });
  it("returns nothing for no target or zero warm-up sets", () => {
    expect(getWarmupSets("compound", null, DEFAULT_SETTINGS)).toEqual([]);
    expect(getWarmupSets("compound", 0, DEFAULT_SETTINGS)).toEqual([]);
    const none: Settings = { ...DEFAULT_SETTINGS, compound: { ...DEFAULT_SETTINGS.compound, warmupSets: 0 } };
    expect(getWarmupSets("compound", 200, none)).toEqual([]);
  });
  it("drops sets that round to nothing or reach the working weight", () => {
    expect(getWarmupSets("compound", 5, DEFAULT_SETTINGS)).toEqual([]);
  });
  it("matches the legacy engine across types, units, counts and weights", () => {
    const targets = [null, undefined, 0, -5, 2.5, 5, 10, 45, 95, 135, 185, 225, 315, 405];
    for (const unit of ["lb", "kg"] as const) {
      for (const count of [0, 1, 2, 3, 4]) {
        const settings: Settings = {
          ...DEFAULT_SETTINGS, unit, increment: unit === "kg" ? 2.5 : 5,
          compound: { ...DEFAULT_SETTINGS.compound, warmupSets: count },
          isolation: { ...DEFAULT_SETTINGS.isolation, warmupSets: count },
        };
        for (const type of ["compound", "isolation"] as const) {
          for (const t of targets) expect(getWarmupSets(type, t, settings)).toEqual(ref.getWarmupSets(type, t, settings));
        }
      }
    }
  });
});
```
(The first expectation's numbers come from the formula: 200 × 0.45 = 90 → round to 5 = 90, 8 reps; 200 × 0.9 = 180, 3 reps. If the legacy-parity test passes but this literal differs, trust the legacy engine and fix the literal.)

`tests/domain/entries.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildEntries, entriesByExercise } from "../../src/domain/entries";
import { syntheticBackup } from "../helpers/fixtures";

describe("entries", () => {
  const { exercises, sessions } = syntheticBackup();

  it("flattens blocks into dated entries", () => {
    const entries = buildEntries(sessions);
    expect(entries).toHaveLength(sessions.reduce((n, s) => n + s.blocks.length, 0));
    expect(entries[0]).toMatchObject({ date: "2026-03-01", sessionName: "Day 1" });
  });

  it("groups per exercise, newest first, with empty buckets for unused exercises", () => {
    const map = entriesByExercise([...exercises, { id: "unused", name: "U", type: "compound", muscleGroup: "Core" }], sessions);
    expect(map["unused"]).toEqual([]);
    const dates = map["ex-ramp"]!.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates).toHaveLength(6);
  });

  it("keeps entries whose exercise no longer exists", () => {
    const orphan = [{ id: "s", date: "2026-01-01", name: "x", blocks: [{ id: "b", exerciseId: "gone", sets: [] }] }];
    expect(entriesByExercise([], orphan)["gone"]).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run and confirm failure**

Run: `npx vitest run tests/domain`
Expected: FAIL, modules `strength`, `warmup`, `entries` not found.

- [ ] **Step 5: Implement**

`src/domain/strength.ts`:
```ts
// Epley estimated 1-rep max. Combines weight AND reps into one strength number
// so rep gains (not just heavier loads) show up as progress.
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}
```

`src/domain/warmup.ts`:
```ts
import type { ExerciseType, Settings } from "./types";
import { plateIncrement } from "./settings";

// Even-percentage warm-up ramp. The count comes from settings; weights and reps
// are calculated from the target working weight so the user only picks "how many".
export function getWarmupSets(
  type: ExerciseType,
  targetWeight: number | null | undefined,
  settings: Settings,
): { weight: number; reps: number }[] {
  const count = settings[type]?.warmupSets ?? 0;
  if (!count || count <= 0 || !targetWeight || targetWeight <= 0) return [];
  const round = plateIncrement(settings.unit);
  const START_PCT = 0.45;
  const END_PCT = 0.9;
  const START_REPS = 8;
  const END_REPS = 3;

  const sets: { weight: number; reps: number }[] = [];
  for (let i = 0; i < count; i++) {
    // t goes 0..1 across the sets; a single set sits at a sensible ~60%.
    const t = count === 1 ? 0.33 : i / (count - 1);
    const pct = START_PCT + (END_PCT - START_PCT) * t;
    const reps = Math.round(START_REPS + (END_REPS - START_REPS) * t);
    const weight = Math.round((targetWeight * pct) / round) * round;
    sets.push({ weight, reps });
  }
  // Drop anything that rounds to nothing or meets/exceeds the working weight.
  return sets.filter((s) => s.weight > 0 && s.weight < targetWeight);
}
```

`src/domain/entries.ts`:
```ts
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
```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. The grid tests prove e1RM and warm-up parity with the legacy engine.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(domain): port e1rm, warm-ups and entry grouping with legacy-parity tests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Progression engine and golden tests

**Files:**
- Create: `src/domain/progression.ts`, `tests/domain/progression.test.ts`, `tests/golden/engine.golden.test.ts`

**Interfaces:**
- Consumes: `Entry`, `Exercise`, `ExerciseType`, `Settings`, `SetEntry`; `plateIncrement`; `entriesByExercise`; `loadBackups`, reference engine.
- Produces: `STALL_SESSIONS`, `BLOWOUT_MARGIN`, `DELOAD_PCT`; `type Suggestion` (discriminated union on `status`); `getSuggestion(exercise: Exercise, entriesDesc: Entry[], settings: Settings): Suggestion`; `getSuggestedTargetWeight(exercise, entriesDesc, settings): number | null`.

- [ ] **Step 1: Write failing unit tests `tests/domain/progression.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getSuggestion, getSuggestedTargetWeight } from "../../src/domain/progression";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Entry, Exercise, Settings } from "../../src/domain/types";

const ex: Exercise = { id: "x", name: "X", type: "compound", muscleGroup: "Chest" };
// newest-first entries; each arg is a [weight, reps] working set
const entry = (date: string, ...sets: [number, number][]): Entry => ({
  id: date, date, sessionName: "s", exerciseId: "x",
  sets: sets.map(([weight, reps]) => ({ weight, reps, warmup: false })),
});

describe("getSuggestion", () => {
  it("no history → no-data", () => {
    expect(getSuggestion(ex, [], DEFAULT_SETTINGS)).toEqual({ status: "no-data" });
  });

  it("warm-up-only latest entry → no-working-sets", () => {
    const warmOnly: Entry = { ...entry("2026-01-01"), sets: [{ weight: 45, reps: 8, warmup: true }] };
    expect(getSuggestion(ex, [warmOnly], DEFAULT_SETTINGS).status).toBe("no-working-sets");
  });

  it("hitting the top of the range on enough sets → increase by one step", () => {
    const s = getSuggestion(ex, [entry("2026-01-02", [50, 8], [50, 8])], DEFAULT_SETTINGS);
    expect(s).toMatchObject({ status: "increase", from: 50, to: 55, big: false });
  });

  it("blowout (top + 3 on every set) → double jump", () => {
    const s = getSuggestion(ex, [entry("2026-01-02", [50, 11], [50, 11])], DEFAULT_SETTINGS);
    expect(s).toMatchObject({ status: "increase", from: 50, to: 60, big: true });
  });

  it("kg uses the configured increment", () => {
    const kg: Settings = { ...DEFAULT_SETTINGS, unit: "kg", increment: 2.5 };
    const s = getSuggestion(ex, [entry("2026-01-02", [60, 8], [60, 8])], kg);
    expect(s).toMatchObject({ status: "increase", to: 62.5 });
  });

  it("below the rep floor → decrease, never below one plate step", () => {
    expect(getSuggestion(ex, [entry("2026-01-02", [100, 5], [100, 4])], DEFAULT_SETTINGS))
      .toMatchObject({ status: "decrease", from: 100, to: 95 });
    expect(getSuggestion(ex, [entry("2026-01-02", [5, 3], [5, 3])], DEFAULT_SETTINGS))
      .toMatchObject({ status: "decrease", to: 5 });
  });

  it("same top weight for 3 sessions with no rep gain → stall deload to 90%", () => {
    const hist = ["2026-01-03", "2026-01-02", "2026-01-01"].map((d) => entry(d, [100, 6], [100, 6]));
    expect(getSuggestion(ex, hist, DEFAULT_SETTINGS)).toMatchObject({ status: "stall", weight: 100, to: 90, sessions: 3 });
  });

  it("in range but not at the top → add-reps with a per-set target", () => {
    const s = getSuggestion(ex, [entry("2026-01-02", [100, 6], [100, 7])], DEFAULT_SETTINGS);
    expect(s).toMatchObject({ status: "add-reps", weight: 100, bestReps: 7, targetReps: 8, progress: 0, targetSets: [7, 7] });
  });
});

describe("getSuggestedTargetWeight", () => {
  it("returns the weight to load next for each actionable status, else null", () => {
    expect(getSuggestedTargetWeight(ex, [entry("d", [50, 8], [50, 8])], DEFAULT_SETTINGS)).toBe(55);
    expect(getSuggestedTargetWeight(ex, [entry("d", [100, 5], [100, 4])], DEFAULT_SETTINGS)).toBe(95);
    expect(getSuggestedTargetWeight(ex, [entry("d", [100, 6], [100, 7])], DEFAULT_SETTINGS)).toBe(100);
    expect(getSuggestedTargetWeight(ex, [], DEFAULT_SETTINGS)).toBeNull();
  });
});
```

- [ ] **Step 2: Write the golden test `tests/golden/engine.golden.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { loadBackups } from "../helpers/fixtures";
import { entriesByExercise } from "../../src/domain/entries";
import { getSuggestion } from "../../src/domain/progression";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import type { Settings } from "../../src/domain/types";
import * as ref from "../reference/legacyEngine.js";

const VARIANTS: Settings[] = [
  DEFAULT_SETTINGS,
  {
    ...DEFAULT_SETTINGS, unit: "kg", increment: 2.5,
    compound: { sets: 3, repBottom: 5, repTop: 5, warmupSets: 3 },
    isolation: { sets: 1, repBottom: 10, repTop: 15, warmupSets: 0 },
  },
];

describe.each(loadBackups())("golden: $name", ({ backup }) => {
  it("new getSuggestion equals the legacy engine at every point in every exercise's history", () => {
    const map = entriesByExercise(backup.exercises, backup.sessions);
    const statuses = new Set<string>();
    let comparisons = 0;
    for (const settings of VARIANTS) {
      for (const exercise of backup.exercises) {
        const desc = map[exercise.id] ?? [];
        // slice(k) = the world as it looked right after the k-th most recent session
        for (let k = 0; k <= desc.length; k++) {
          const history = desc.slice(k);
          const next = getSuggestion(exercise, history, settings);
          expect(next).toEqual(ref.getSuggestion(exercise, history, settings));
          statuses.add(next.status);
          comparisons++;
        }
      }
    }
    expect(comparisons).toBeGreaterThan(0);
    if (backup.exercises[0]?.id === "ex-stall") {
      // synthetic fixture must hit every branch, or the golden test proves too little
      expect([...statuses].sort()).toEqual(["add-reps", "decrease", "increase", "no-data", "no-working-sets", "stall"]);
    }
  });
});
```
(`increase` covers both normal and `big`; `big` is asserted in the unit tests.)

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run tests/domain/progression.test.ts tests/golden`
Expected: FAIL, `progression` module not found.

- [ ] **Step 4: Implement `src/domain/progression.ts`**

```ts
import type { Entry, Exercise, ExerciseType, SetEntry, Settings } from "./types";
import { plateIncrement } from "./settings";

// Coaching tuning (identical to the pre-rewrite engine).
export const STALL_SESSIONS = 3; // same top weight, no rep gain, this many sessions → deload
export const BLOWOUT_MARGIN = 3; // reps past the top of the range that earn a double jump
export const DELOAD_PCT = 0.9; // deload target = 90% of the stalled weight

export type Suggestion =
  | { status: "no-data" }
  | { status: "no-working-sets"; last: Entry }
  | { status: "increase"; from: number; to: number; resetReps: number; needed: number; big: boolean; date: string }
  | { status: "decrease"; from: number; to: number; bottom: number; bestReps: number; date: string }
  | { status: "stall"; weight: number; to: number; sessions: number; date: string }
  | {
      status: "add-reps"; weight: number; sets: SetEntry[]; bestReps: number; targetReps: number; top: number;
      progress: number; needed: number; lastReps: number[]; targetSets: number[]; date: string;
    };

function topBottom(type: ExerciseType, settings: Settings) {
  const s = settings[type] || settings.compound;
  return { top: s.repTop, bottom: s.repBottom };
}

// Best working-set reps at a given weight in a session's entry, or 0 if none.
function bestRepsAtWeight(entry: Entry, weight: number): number {
  const reps = entry.sets.filter((s) => !s.warmup && s.weight === weight).map((s) => s.reps);
  return reps.length ? Math.max(...reps) : 0;
}

// Double progression: earn reps up to the top of the range, then add weight and
// reset. Reads recent history so it can also spot blowouts (big jump) and stalls
// (deload). Precedence: increase → decrease (too heavy) → stall → add reps.
export function getSuggestion(exercise: Exercise, entriesDesc: Entry[], settings: Settings): Suggestion {
  if (!entriesDesc.length) return { status: "no-data" };
  const last = entriesDesc[0]!;
  const working = last.sets.filter((s) => !s.warmup);
  if (!working.length) return { status: "no-working-sets", last };
  const { top, bottom } = topBottom(exercise.type, settings);
  const needed = settings[exercise.type]?.sets ?? 2;
  const increment = settings.increment;
  const round = plateIncrement(settings.unit);

  const byWeight: Record<string, number[]> = {};
  working.forEach((s) => {
    (byWeight[s.weight] ??= []).push(s.reps);
  });

  let increaseWeight: number | null = null;
  for (const [w, repsArr] of Object.entries(byWeight)) {
    const countTop = repsArr.filter((r) => r >= top).length;
    if (countTop >= needed) increaseWeight = Math.max(increaseWeight || 0, Number(w));
  }

  if (increaseWeight != null) {
    // Blowout: crushed every set at that weight by top + margin → double the jump.
    const repsAtInc = byWeight[increaseWeight] || [];
    const big = repsAtInc.length >= needed && repsAtInc.every((r) => r >= top + BLOWOUT_MARGIN);
    const to = increaseWeight + (big ? 2 : 1) * increment;
    return { status: "increase", from: increaseWeight, to, resetReps: bottom, needed, big, date: last.date };
  }

  const mainWeight = Math.max(...working.map((s) => s.weight));
  const setsAtMain = working.filter((s) => s.weight === mainWeight);
  const bestReps = Math.max(...setsAtMain.map((s) => s.reps));

  // Fell below the target range even on your best set here — the weight's too
  // heavy. Drop a step and rebuild reps from the bottom of the range.
  if (bestReps < bottom) {
    const to = Math.max(round, mainWeight - increment);
    return { status: "decrease", from: mainWeight, to, bottom, bestReps, date: last.date };
  }

  // Stall: same top weight for STALL_SESSIONS straight with no rep improvement.
  // Count the consecutive most-recent sessions whose top working weight matches.
  const run: Entry[] = [];
  for (const entry of entriesDesc) {
    const w = entry.sets.filter((s) => !s.warmup);
    if (!w.length) continue; // ignore warm-up-only days
    if (Math.max(...w.map((s) => s.weight)) !== mainWeight) break;
    run.push(entry);
  }
  if (run.length >= STALL_SESSIONS) {
    const oldestBest = bestRepsAtWeight(run[STALL_SESSIONS - 1]!, mainWeight);
    if (bestReps <= oldestBest) {
      const to = Math.max(round, Math.round((mainWeight * DELOAD_PCT) / round) * round);
      return { status: "stall", weight: mainWeight, to, sessions: run.length, date: last.date };
    }
  }

  // In range but not at the top yet — coach reps at the top working weight, with
  // a concrete per-set target (bump the lowest sub-top set by one).
  const progress = setsAtMain.filter((s) => s.reps >= top).length;
  const targetReps = Math.min(top, bestReps + 1);
  const lastReps = setsAtMain.map((s) => s.reps);
  const targetSets = [...lastReps];
  let bumpIdx = -1;
  let bumpVal = Infinity;
  targetSets.forEach((r, i) => {
    if (r < top && r < bumpVal) {
      bumpVal = r;
      bumpIdx = i;
    }
  });
  if (bumpIdx >= 0) targetSets[bumpIdx] = Math.min(top, targetSets[bumpIdx]! + 1);
  return { status: "add-reps", weight: mainWeight, sets: setsAtMain, bestReps, targetReps, top, progress, needed, lastReps, targetSets, date: last.date };
}

export function getSuggestedTargetWeight(exercise: Exercise, entriesDesc: Entry[], settings: Settings): number | null {
  const suggestion = getSuggestion(exercise, entriesDesc, settings);
  if (suggestion.status === "increase" || suggestion.status === "decrease" || suggestion.status === "stall") return suggestion.to;
  if (suggestion.status === "add-reps") return suggestion.weight;
  return null;
}
```
(The only deliberate difference from the old code is `for…of` instead of `forEach` for `increaseWeight`, because TypeScript narrows a `let` assigned inside a callback to `null` and then rejects the later check. Behavior is identical and the golden test proves it.)

- [ ] **Step 5: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including golden tests for `synthetic` plus `real-oct` and `real-aug` when `fixtures/` exists. If the synthetic status-set assertion fails, apply the fix described under Step 2 and re-run. If any golden comparison fails on real data, stop — that is a behavior difference between the engines; return to Plan Mode rather than editing expectations.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(domain): port progression engine with golden parity tests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Key-value adapter, normalization and v2 store

**Files:**
- Create: `src/data/kv.ts`, `src/data/normalize.ts`, `src/data/store.ts`, `tests/data/normalize.test.ts`, `tests/data/store.test.ts`

**Interfaces:**
- Consumes: types, `mergeSettings`, `DEFAULT_SETTINGS`.
- Produces:
  - `interface KeyValueStore { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }`
  - `createLocalStorageKV(storage?: Pick<Storage,"getItem"|"setItem">): KeyValueStore` (errors propagate)
  - `createMemoryKV(initial?: Record<string,string>): KeyValueStore & { dump(): Record<string,string> }`
  - `class DataError extends Error { where?: string }`, `type Warn = (msg: string) => void`
  - `validateDoc(raw: unknown, warn: Warn): StoreDoc` (requires `schemaVersion: 2`)
  - `V2_KEY = "overload.v2"`, `emptyDoc(): StoreDoc`, `loadDoc(kv, warn): Promise<StoreDoc | null>`, `saveDoc(kv, doc): Promise<void>`

- [ ] **Step 1: Write failing tests `tests/data/normalize.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { DataError, validateDoc } from "../../src/data/normalize";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";

const ex = { id: "e1", name: "Bench", type: "compound", muscleGroup: "Chest" };
const doc = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 2, exercises: [ex], sessions: [], customGroups: [], settings: DEFAULT_SETTINGS, ...over,
});
const session = (sets: unknown[], over: Record<string, unknown> = {}) => ({
  id: "s1", date: "2026-07-18", name: "Push",
  blocks: [{ id: "b1", exerciseId: "e1", sets }], ...over,
});
const run = (raw: unknown) => {
  const warnings: string[] = [];
  const result = validateDoc(raw, (m) => warnings.push(m));
  return { result, warnings };
};

describe("validateDoc", () => {
  it("accepts a clean document unchanged", () => {
    const raw = doc({ sessions: [session([{ weight: 135, reps: 8, warmup: false }])] });
    const { result, warnings } = run(raw);
    expect(result).toMatchObject({ schemaVersion: 2, exercises: [ex], programs: [] });
    expect(result.sessions).toEqual(raw.sessions);
    expect(warnings).toEqual([]);
  });

  it("coerces numeric strings, defaults missing warmup to false, keeps unknown fields", () => {
    const { result } = run(doc({ sessions: [session([{ weight: "135", reps: "8", note: "pause" }])] }));
    expect(result.sessions[0]!.blocks[0]!.sets[0]).toEqual({ weight: 135, reps: 8, warmup: false, note: "pause" });
  });

  it("rejects NaN, negative and non-numeric weights/reps", () => {
    for (const bad of [{ weight: NaN, reps: 5 }, { weight: -5, reps: 5 }, { weight: "abc", reps: 5 }, { weight: 5, reps: -1 }, { weight: 5 }]) {
      expect(() => run(doc({ sessions: [session([bad])] }))).toThrow(DataError);
    }
  });

  it("rejects malformed dates", () => {
    expect(() => run(doc({ sessions: [session([], { date: "07/18/2026" })] }))).toThrow(DataError);
  });

  it("keeps orphan blocks (deleted exercise) and warns", () => {
    const orphan = session([{ weight: 1, reps: 1, warmup: false }], { blocks: [{ id: "b9", exerciseId: "gone", sets: [] }] });
    const { result, warnings } = run(doc({ sessions: [orphan] }));
    expect(result.sessions[0]!.blocks).toHaveLength(1);
    expect(warnings.some((w) => w.includes("gone"))).toBe(true);
  });

  it("falls back for an invalid exercise type and warns", () => {
    const { result, warnings } = run(doc({ exercises: [{ ...ex, type: "Compound" }] }));
    expect(result.exercises[0]!.type).toBe("compound");
    expect(warnings).toHaveLength(1);
  });

  it("merges partial settings and repairs garbage numerics", () => {
    const { result, warnings } = run(doc({ settings: { unit: "kg", increment: "x", compound: { sets: 3 } } }));
    expect(result.settings.unit).toBe("kg");
    expect(result.settings.increment).toBe(DEFAULT_SETTINGS.increment);
    expect(result.settings.compound.sets).toBe(3);
    expect(result.settings.compound.repTop).toBe(8);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("requires schemaVersion 2 and arrays", () => {
    expect(() => run(doc({ schemaVersion: 1 }))).toThrow(DataError);
    expect(() => run(doc({ exercises: "nope" }))).toThrow(DataError);
    expect(() => run(null)).toThrow(DataError);
  });
});
```

`tests/data/store.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createLocalStorageKV, createMemoryKV } from "../../src/data/kv";
import { V2_KEY, emptyDoc, loadDoc, saveDoc } from "../../src/data/store";
import { DataError } from "../../src/data/normalize";
import { syntheticBackup } from "../helpers/fixtures";

const warn = () => {};

describe("store", () => {
  it("round-trips a document under overload.v2", async () => {
    const kv = createMemoryKV();
    expect(await loadDoc(kv, warn)).toBeNull();
    const b = syntheticBackup();
    const doc = { ...emptyDoc(), exercises: b.exercises, sessions: b.sessions, customGroups: b.customGroups, settings: b.settings };
    await saveDoc(kv, doc);
    expect(Object.keys(kv.dump())).toEqual([V2_KEY]);
    expect(await loadDoc(kv, warn)).toEqual(doc);
  });

  it("throws a DataError for a corrupt v2 document", async () => {
    await expect(loadDoc(createMemoryKV({ [V2_KEY]: "{not json" }), warn)).rejects.toBeInstanceOf(DataError);
  });

  it("saveDoc rejects when storage fails (quota) and leaves the previous doc intact", async () => {
    const inner = createMemoryKV();
    await saveDoc(inner, emptyDoc());
    const before = inner.dump()[V2_KEY];
    const failing = { get: inner.get, set: async () => { throw new Error("QuotaExceededError"); } };
    await expect(saveDoc(failing, emptyDoc())).rejects.toThrow("QuotaExceededError");
    expect(inner.dump()[V2_KEY]).toBe(before);
  });
});

describe("createLocalStorageKV", () => {
  it("returns null for missing keys and propagates write errors", async () => {
    const data = new Map<string, string>();
    const kv = createLocalStorageKV({
      getItem: (k) => data.get(k) ?? null,
      setItem: () => { throw new Error("boom"); },
    });
    expect(await kv.get("nope")).toBeNull();
    await expect(kv.set("a", "b")).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/data`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/data/kv.ts`**

```ts
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// Errors propagate (the old wrapper swallowed them, which could hide data loss).
export function createLocalStorageKV(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): KeyValueStore {
  return {
    async get(key) {
      return storage.getItem(key);
    },
    async set(key, value) {
      storage.setItem(key, value);
    },
  };
}

export function createMemoryKV(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}
```

- [ ] **Step 4: Implement `src/data/normalize.ts`**

```ts
import { DEFAULT_SETTINGS, mergeSettings } from "../domain/settings";
import type { Block, Exercise, Program, Session, SetEntry, Settings, StoreDoc, TypeSettings } from "../domain/types";

export class DataError extends Error {
  constructor(message: string, readonly where?: string) {
    super(message);
    this.name = "DataError";
  }
}
export type Warn = (message: string) => void;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function reqString(v: unknown, label: string): string {
  if (typeof v === "string" && v.length > 0) return v;
  throw new DataError(`${label} must be a non-empty string`);
}

function reqArray(v: unknown, label: string): unknown[] {
  if (Array.isArray(v)) return v;
  throw new DataError(`${label} must be an array`);
}

function normalizeSet(raw: unknown, where: string): SetEntry {
  if (!isObj(raw)) throw new DataError(`${where}: set must be an object`);
  const weight = toNumber(raw.weight);
  const reps = toNumber(raw.reps);
  if (weight === null || weight < 0) throw new DataError(`${where}: invalid weight ${JSON.stringify(raw.weight)}`);
  if (reps === null || reps < 0) throw new DataError(`${where}: invalid reps ${JSON.stringify(raw.reps)}`);
  const out = { ...raw, weight, reps, warmup: Boolean(raw.warmup) } as SetEntry;
  if (raw.rpe != null) {
    const rpe = toNumber(raw.rpe);
    if (rpe === null || rpe < 1 || rpe > 10) throw new DataError(`${where}: invalid rpe ${JSON.stringify(raw.rpe)}`);
    out.rpe = rpe;
  }
  return out;
}

function normalizeBlock(raw: unknown, where: string): Block {
  if (!isObj(raw)) throw new DataError(`${where}: block must be an object`);
  const id = reqString(raw.id, `${where}.id`);
  const exerciseId = reqString(raw.exerciseId, `${where}.exerciseId`);
  const sets = reqArray(raw.sets, `${where}.sets`).map((s, i) => normalizeSet(s, `${where}.sets[${i}]`));
  return { ...raw, id, exerciseId, sets } as Block;
}

export function normalizeExercises(raw: unknown, warn: Warn): Exercise[] {
  return reqArray(raw, "exercises").map((e, i) => {
    if (!isObj(e)) throw new DataError(`exercises[${i}] must be an object`);
    const id = reqString(e.id, `exercises[${i}].id`);
    const name = reqString(e.name, `exercises[${i}].name`);
    let type = e.type;
    if (type !== "compound" && type !== "isolation") {
      warn(`Exercise "${name}" has invalid type ${JSON.stringify(type)}; using "compound"`);
      type = "compound";
    }
    const muscleGroup = typeof e.muscleGroup === "string" ? e.muscleGroup : "";
    return { ...e, id, name, type, muscleGroup } as Exercise;
  });
}

export function normalizeSessions(raw: unknown, warn: Warn): Session[] {
  const seenDates = new Set<string>();
  return reqArray(raw, "sessions").map((s, i) => {
    if (!isObj(s)) throw new DataError(`sessions[${i}] must be an object`);
    const id = reqString(s.id, `sessions[${i}].id`);
    if (typeof s.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
      throw new DataError(`sessions[${i}] has invalid date ${JSON.stringify(s.date)}`);
    }
    if (seenDates.has(s.date)) warn(`More than one session on ${s.date}`);
    seenDates.add(s.date);
    const name = typeof s.name === "string" ? s.name : "";
    const blocks = reqArray(s.blocks, `sessions[${i}].blocks`).map((b, j) => normalizeBlock(b, `sessions[${i}].blocks[${j}]`));
    return { ...s, id, date: s.date, name, blocks } as Session;
  });
}

export function normalizeCustomGroups(raw: unknown): string[] {
  const list = reqArray(raw, "customGroups");
  list.forEach((g, i) => {
    if (typeof g !== "string") throw new DataError(`customGroups[${i}] must be a string`);
  });
  return list as string[];
}

function num(v: unknown, fallback: number, label: string, warn: Warn): number {
  const n = toNumber(v);
  if (n === null) {
    warn(`settings.${label} is invalid; using default ${fallback}`);
    return fallback;
  }
  return n;
}

function normalizeTypeSettings(raw: TypeSettings, def: TypeSettings, label: string, warn: Warn): TypeSettings {
  return {
    ...raw,
    sets: num(raw.sets, def.sets, `${label}.sets`, warn),
    repBottom: num(raw.repBottom, def.repBottom, `${label}.repBottom`, warn),
    repTop: num(raw.repTop, def.repTop, `${label}.repTop`, warn),
    warmupSets: num(raw.warmupSets, def.warmupSets, `${label}.warmupSets`, warn),
  };
}

export function normalizeSettings(raw: unknown, warn: Warn): Settings {
  const m = mergeSettings(raw);
  if (m.unit !== "lb" && m.unit !== "kg") warn(`settings.unit ${JSON.stringify(m.unit)} is invalid; using "lb"`);
  return {
    ...m,
    unit: m.unit === "kg" ? "kg" : "lb",
    increment: num(m.increment, DEFAULT_SETTINGS.increment, "increment", warn),
    compound: normalizeTypeSettings(m.compound, DEFAULT_SETTINGS.compound, "compound", warn),
    isolation: normalizeTypeSettings(m.isolation, DEFAULT_SETTINGS.isolation, "isolation", warn),
    restTimer: { ...m.restTimer, defaultSeconds: num(m.restTimer.defaultSeconds, DEFAULT_SETTINGS.restTimer.defaultSeconds, "restTimer.defaultSeconds", warn) },
  };
}

export function validateDoc(raw: unknown, warn: Warn): StoreDoc {
  if (!isObj(raw)) throw new DataError("Store document must be an object");
  if (raw.schemaVersion !== 2) throw new DataError(`Unsupported schemaVersion: ${String(raw.schemaVersion)}`);
  const exercises = normalizeExercises(raw.exercises, warn);
  const sessions = normalizeSessions(raw.sessions, warn);
  const customGroups = normalizeCustomGroups(raw.customGroups);
  const settings = normalizeSettings(raw.settings, warn);
  const programs = Array.isArray(raw.programs) ? (raw.programs as Program[]) : [];
  const ids = new Set(exercises.map((e) => e.id));
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (!ids.has(b.exerciseId)) warn(`Orphan block ${b.id} in session ${s.date}: unknown exercise ${b.exerciseId}`);
    }
  }
  return { schemaVersion: 2, exercises, sessions, customGroups, settings, programs };
}
```

- [ ] **Step 5: Implement `src/data/store.ts`**

```ts
import { DEFAULT_SETTINGS } from "../domain/settings";
import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { DataError, validateDoc, type Warn } from "./normalize";

export const V2_KEY = "overload.v2";

export function emptyDoc(): StoreDoc {
  return { schemaVersion: 2, exercises: [], sessions: [], customGroups: [], settings: structuredClone(DEFAULT_SETTINGS), programs: [] };
}

export async function loadDoc(kv: KeyValueStore, warn: Warn): Promise<StoreDoc | null> {
  const raw = await kv.get(V2_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DataError(`${V2_KEY} is not valid JSON`, V2_KEY);
  }
  return validateDoc(parsed, warn);
}

// One write of the whole document: a failure leaves the previous value intact.
export async function saveDoc(kv: KeyValueStore, doc: StoreDoc): Promise<void> {
  await kv.set(V2_KEY, JSON.stringify(doc));
}
```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(data): add key-value adapter, tolerant normalization and v2 store" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Legacy migration and boot

**Files:**
- Create: `src/data/migrate.ts`, `src/data/boot.ts`, `tests/data/boot.test.ts`

**Interfaces:**
- Consumes: `KeyValueStore`, `validateDoc`, `DataError`, `loadDoc`, `saveDoc`, `emptyDoc`, `V2_KEY`.
- Produces:
  - `LEGACY_KEYS = ["exercises","sessions","customGroups","settings"] as const`
  - `readLegacy(kv): Promise<Record<string, unknown> | null>` (null if no legacy key exists; throws `DataError` naming the key on bad JSON)
  - `legacyToDoc(legacy: Record<string, unknown>, warn: Warn): StoreDoc` (missing keys → `[]` / default settings)
  - `type BootResult = { kind: "v2" | "migrated" | "fresh"; doc: StoreDoc; warnings: string[] }`
  - `bootStore(kv, opts?: { persist?: boolean }): Promise<BootResult>` (`persist` defaults to `true`)
  - `dumpLegacyRaw(kv): Promise<Record<string, string>>`

- [ ] **Step 1: Write failing tests `tests/data/boot.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { bootStore, dumpLegacyRaw } from "../../src/data/boot";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { LEGACY_KEYS } from "../../src/data/migrate";
import { DataError } from "../../src/data/normalize";
import { V2_KEY } from "../../src/data/store";
import { mergeSettings } from "../../src/domain/settings";
import { loadBackups, type BackupV1 } from "../helpers/fixtures";

const seed = (b: BackupV1) =>
  createMemoryKV({
    exercises: JSON.stringify(b.exercises),
    sessions: JSON.stringify(b.sessions),
    customGroups: JSON.stringify(b.customGroups),
    settings: JSON.stringify(b.settings),
  });

// Fails loudly if anything tries to write a legacy key.
function guarded(inner: KeyValueStore): KeyValueStore {
  return {
    get: inner.get,
    set: async (key, value) => {
      if ((LEGACY_KEYS as readonly string[]).includes(key)) throw new Error(`illegal write to legacy key ${key}`);
      await inner.set(key, value);
    },
  };
}

describe.each(loadBackups())("migration: $name", ({ backup }) => {
  it("migrates losslessly, writes only overload.v2, and leaves legacy keys byte-identical", async () => {
    const kv = seed(backup);
    const before = kv.dump();
    const result = await bootStore(guarded(kv));
    expect(result.kind).toBe("migrated");
    expect(result.doc.exercises).toEqual(backup.exercises);
    expect(result.doc.sessions).toEqual(backup.sessions);
    expect(result.doc.customGroups).toEqual(backup.customGroups);
    expect(result.doc.settings).toEqual(mergeSettings(backup.settings));
    const after = kv.dump();
    for (const key of LEGACY_KEYS) expect(after[key]).toBe(before[key]);
    expect(Object.keys(after).sort()).toEqual([...LEGACY_KEYS, V2_KEY].sort());
  });

  it("is idempotent: the second boot reads v2 and changes nothing", async () => {
    const kv = seed(backup);
    const first = await bootStore(kv);
    const snapshot = kv.dump();
    const second = await bootStore(kv);
    expect(second.kind).toBe("v2");
    expect(second.doc).toEqual(first.doc);
    expect(kv.dump()).toEqual(snapshot);
  });

  it("dry run (persist:false) reports a migration but writes nothing", async () => {
    const kv = seed(backup);
    const before = kv.dump();
    const result = await bootStore(kv, { persist: false });
    expect(result.kind).toBe("migrated");
    expect(result.doc.sessions).toEqual(backup.sessions);
    expect(kv.dump()).toEqual(before);
  });
});

describe("boot edge cases", () => {
  it("fresh install: writes an empty v2 doc", async () => {
    const kv = createMemoryKV();
    const r = await bootStore(kv);
    expect(r.kind).toBe("fresh");
    expect(r.doc.exercises).toEqual([]);
    expect(kv.dump()[V2_KEY]).toBeDefined();
  });

  it("partial legacy data (only exercises) gets defaults for the rest", async () => {
    const kv = createMemoryKV({ exercises: JSON.stringify([{ id: "e", name: "E", type: "compound", muscleGroup: "Chest" }]) });
    const r = await bootStore(kv);
    expect(r.doc.exercises).toHaveLength(1);
    expect(r.doc.sessions).toEqual([]);
    expect(r.doc.settings.unit).toBe("lb");
  });

  it("a corrupt overload.v2 throws and does NOT fall back to re-migrating legacy", async () => {
    const b = loadBackups()[0]!.backup;
    const kv = seed(b);
    await kv.set(V2_KEY, "{corrupt");
    await expect(bootStore(kv)).rejects.toBeInstanceOf(DataError);
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });

  it("corrupt legacy JSON throws naming the key and writes nothing", async () => {
    const kv = createMemoryKV({ exercises: "[]", sessions: "{nope" });
    await expect(bootStore(kv)).rejects.toThrow(/sessions/);
    expect(kv.dump()[V2_KEY]).toBeUndefined();
  });

  it("dumpLegacyRaw returns the raw legacy strings for the error-screen export", async () => {
    const kv = createMemoryKV({ exercises: "[1]", unrelated: "x" });
    expect(await dumpLegacyRaw(kv)).toEqual({ exercises: "[1]" });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/data/boot.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/data/migrate.ts`**

```ts
import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { DataError, validateDoc, type Warn } from "./normalize";

export const LEGACY_KEYS = ["exercises", "sessions", "customGroups", "settings"] as const;

/** Parsed legacy values by key, or null when no legacy key exists. Never writes. */
export async function readLegacy(kv: KeyValueStore): Promise<Record<string, unknown> | null> {
  const out: Record<string, unknown> = {};
  let any = false;
  for (const key of LEGACY_KEYS) {
    const raw = await kv.get(key);
    if (raw === null) continue;
    any = true;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      throw new DataError(`Legacy key "${key}" is not valid JSON`, key);
    }
  }
  return any ? out : null;
}

/** Shared by migration and v1-backup import. Missing keys become empty/default. */
export function legacyToDoc(legacy: Record<string, unknown>, warn: Warn): StoreDoc {
  return validateDoc(
    {
      schemaVersion: 2,
      exercises: legacy.exercises ?? [],
      sessions: legacy.sessions ?? [],
      customGroups: legacy.customGroups ?? [],
      settings: legacy.settings,
      programs: [],
    },
    warn,
  );
}
```

- [ ] **Step 4: Implement `src/data/boot.ts`**

```ts
import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { LEGACY_KEYS, legacyToDoc, readLegacy } from "./migrate";
import { emptyDoc, loadDoc, saveDoc } from "./store";

export interface BootResult {
  kind: "v2" | "migrated" | "fresh";
  doc: StoreDoc;
  warnings: string[];
}

/**
 * v2 present → use it (legacy ignored; a corrupt v2 throws rather than falling
 * back, so older legacy data can never overwrite newer v2 data).
 * Else legacy present → migrate. Else fresh.
 * `persist:false` is a dry run: nothing is written.
 */
export async function bootStore(kv: KeyValueStore, opts: { persist?: boolean } = {}): Promise<BootResult> {
  const persist = opts.persist ?? true;
  const warnings: string[] = [];
  const warn = (m: string) => void warnings.push(m);

  const existing = await loadDoc(kv, warn);
  if (existing) return { kind: "v2", doc: existing, warnings };

  const legacy = await readLegacy(kv);
  if (!legacy) {
    const doc = emptyDoc();
    if (persist) await saveDoc(kv, doc);
    return { kind: "fresh", doc, warnings };
  }
  const doc = legacyToDoc(legacy, warn);
  if (persist) await saveDoc(kv, doc);
  return { kind: "migrated", doc, warnings };
}

/** Raw legacy strings, for the "export what's there" escape hatch on a failed boot. */
export async function dumpLegacyRaw(kv: KeyValueStore): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const raw = await kv.get(key);
    if (raw !== null) out[key] = raw;
  }
  return out;
}
```

- [ ] **Step 5: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including migrations of the real Oct and Aug backups when `fixtures/` exists.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(data): migrate legacy keys to overload.v2 with dry-run and safety guarantees" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Backup import and export

**Files:**
- Create: `src/data/backup.ts`, `tests/data/backup.test.ts`

**Interfaces:**
- Consumes: `legacyToDoc`, `validateDoc`, `DataError`, `saveDoc`, `loadDoc`, `KeyValueStore`.
- Produces: `exportBackup(doc: StoreDoc, now?: Date): string`; `parseBackup(text: string, warn: Warn): StoreDoc`; `importBackup(kv: KeyValueStore, text: string, warn: Warn): Promise<StoreDoc>` (parse and validate first; write only on success).

- [ ] **Step 1: Write failing tests `tests/data/backup.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { exportBackup, importBackup, parseBackup } from "../../src/data/backup";
import { createMemoryKV } from "../../src/data/kv";
import { legacyToDoc } from "../../src/data/migrate";
import { DataError } from "../../src/data/normalize";
import { V2_KEY, emptyDoc, loadDoc, saveDoc } from "../../src/data/store";
import { loadBackups } from "../helpers/fixtures";

const warn = () => {};

describe.each(loadBackups())("backup: $name", ({ backup }) => {
  it("imports a v1 backup identically to migrating its legacy keys", () => {
    const fromV1 = parseBackup(JSON.stringify(backup), warn);
    expect(fromV1).toEqual(legacyToDoc({ ...backup }, warn));
    expect(fromV1.sessions).toEqual(backup.sessions);
  });

  it("v1 → v2 export → import round-trips losslessly", () => {
    const doc = parseBackup(JSON.stringify(backup), warn);
    const text = exportBackup(doc, new Date("2026-10-09T12:00:00Z"));
    expect(JSON.parse(text)).toMatchObject({ app: "overload", version: 2, exportedAt: "2026-10-09T12:00:00.000Z" });
    expect(parseBackup(text, warn)).toEqual(doc);
  });
});

describe("parseBackup rejections", () => {
  it("rejects invalid JSON, non-Overload files and unknown versions", () => {
    expect(() => parseBackup("{nope", warn)).toThrow(DataError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }), warn)).toThrow(/Overload/);
    expect(() => parseBackup(JSON.stringify({ app: "overload", version: 3 }), warn)).toThrow(/version/);
  });

  it("treats missing v1 arrays as empty", () => {
    const doc = parseBackup(JSON.stringify({ app: "overload", version: 1 }), warn);
    expect(doc.exercises).toEqual([]);
    expect(doc.settings.unit).toBe("lb");
  });
});

describe("importBackup", () => {
  it("replaces the store on a valid file", async () => {
    const kv = createMemoryKV();
    const b = loadBackups()[0]!.backup;
    const doc = await importBackup(kv, JSON.stringify(b), warn);
    expect(await loadDoc(kv, warn)).toEqual(doc);
  });

  it("leaves the existing store untouched when the file is invalid", async () => {
    const kv = createMemoryKV();
    await saveDoc(kv, emptyDoc());
    const before = kv.dump()[V2_KEY];
    const bad = { app: "overload", version: 1, exercises: [], sessions: [{ id: "s", date: "bad", name: "", blocks: [] }] };
    await expect(importBackup(kv, JSON.stringify(bad), warn)).rejects.toBeInstanceOf(DataError);
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/data/backup.test.ts`
Expected: FAIL, `backup` module not found.

- [ ] **Step 3: Implement `src/data/backup.ts`**

```ts
import type { StoreDoc } from "../domain/types";
import type { KeyValueStore } from "./kv";
import { legacyToDoc } from "./migrate";
import { DataError, validateDoc, type Warn } from "./normalize";
import { saveDoc } from "./store";

export function exportBackup(doc: StoreDoc, now: Date = new Date()): string {
  return JSON.stringify({ app: "overload", version: 2, exportedAt: now.toISOString(), ...doc }, null, 2);
}

/** Accepts v1 (legacy shape) and v2 files. Pure: validates, never writes. */
export function parseBackup(text: string, warn: Warn): StoreDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DataError("Backup file is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || (raw as { app?: unknown }).app !== "overload") {
    throw new DataError("Not an Overload backup file");
  }
  const file = raw as Record<string, unknown>;
  if (file.version === 1) return legacyToDoc(file, warn);
  if (file.version === 2) return validateDoc(file, warn);
  throw new DataError(`Unsupported backup version: ${String(file.version)}`);
}

/** Parse and validate fully first; the store is only written if the whole file is valid. */
export async function importBackup(kv: KeyValueStore, text: string, warn: Warn): Promise<StoreDoc> {
  const doc = parseBackup(text, warn);
  await saveDoc(kv, doc);
  return doc;
}
```

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(data): add v1/v2 backup import and v2 export" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Read-only dev page, build wiring, handoff

**Files:**
- Create: `dev.html`, `src/dev/main.ts`
- Modify: `vite.config.js` (second build entry + service-worker denylist), `HANDOFF.md`

**Interfaces:**
- Consumes: `createLocalStorageKV`, `bootStore`, `dumpLegacyRaw`, `exportBackup`.
- Produces: a page at `/dev.html` that dry-runs the migration against the browser's real localStorage, shows counts and warnings, offers a v2-backup download, and never writes storage. No import.

- [ ] **Step 1: Create `dev.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Overload — data check</title>
    <style>
      body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 20px; background: #1c1b19; color: #eee; }
      h1 { font-size: 18px; } pre { white-space: pre-wrap; } button { font: inherit; padding: 10px 14px; margin: 6px 6px 6px 0; }
      .err { color: #ff8a65; }
    </style>
  </head>
  <body>
    <h1>Overload data check (read-only)</h1>
    <div id="out">Checking…</div>
    <script type="module" src="/src/dev/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/dev/main.ts`** (uses `textContent` only, so exercise names can't inject markup)

```ts
import { exportBackup } from "../data/backup";
import { bootStore, dumpLegacyRaw } from "../data/boot";
import { createLocalStorageKV } from "../data/kv";

const out = document.getElementById("out")!;

function line(text: string, cls?: string) {
  const p = document.createElement("pre");
  p.textContent = text;
  if (cls) p.className = cls;
  out.appendChild(p);
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function button(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = onClick;
  out.appendChild(b);
}

async function main() {
  out.textContent = "";
  const kv = createLocalStorageKV();
  try {
    // Dry run: nothing is written. The real migration happens in the new UI.
    const { kind, doc, warnings } = await bootStore(kv, { persist: false });
    line(`Result: ${kind}`);
    line(`${doc.exercises.length} exercises · ${doc.sessions.length} sessions · ${doc.customGroups.length} custom groups`);
    const dates = doc.sessions.map((s) => s.date).sort();
    if (dates.length) line(`History: ${dates[0]} → ${dates[dates.length - 1]}`);
    line(`Settings: ${doc.settings.unit}, increment ${doc.settings.increment}`);
    line(warnings.length ? `Warnings:\n${warnings.join("\n")}` : "No warnings.");
    button("Download v2 backup", () => download(`overload-v2-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(doc)));
  } catch (e) {
    line(`Could not read your data: ${e instanceof Error ? e.message : String(e)}`, "err");
    line("Nothing was changed. You can still save exactly what is stored:");
    button("Download raw data", async () => download("overload-raw.json", JSON.stringify(await dumpLegacyRaw(kv), null, 2)));
  }
}

void main();
```

- [ ] **Step 3: Wire the second entry and the service-worker denylist in `vite.config.js`**

Add at the top: `import { fileURLToPath } from 'node:url'`. Inside `defineConfig({...})` add:
```js
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dev: fileURLToPath(new URL('./dev.html', import.meta.url)),
      },
    },
  },
```
and inside the existing `workbox: {...}` add:
```js
        // Let /dev.html load as its own page instead of falling back to the app shell.
        navigateFallbackDenylist: [/dev\.html$/],
```

- [ ] **Step 4: Run the gate and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build && ls dist/dev.html`
Expected: tests/typecheck/lint pass; build succeeds; `dist/dev.html` exists; `dist/index.html` still present (legacy app untouched).

- [ ] **Step 5: Verify the page in a real browser with seeded legacy data**

Run `npm run preview` in the background. With the Playwright tools: navigate to `http://localhost:4173/dev.html`; evaluate
`localStorage.setItem('exercises', JSON.stringify([{id:'e1',name:'Bench',type:'compound',muscleGroup:'Chest'}])); localStorage.setItem('sessions', JSON.stringify([{id:'s1',date:'2026-07-18',name:'Push',blocks:[{id:'b1',exerciseId:'e1',sets:[{weight:135,reps:8,warmup:false}]}]}]))`;
reload; confirm the page shows `Result: migrated` and `1 exercises · 1 sessions`; then evaluate `localStorage.getItem('overload.v2')` and confirm it is `null` (dry run wrote nothing). Also load `http://localhost:4173/` and confirm the legacy app still renders. Stop the preview server afterward.
Expected: all three confirmations hold.

- [ ] **Step 6: Commit the code**

```bash
git add -A && git commit -m "feat(dev): add read-only migration dry-run page and build wiring" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Update `HANDOFF.md` and show the State Update**

Replace the `## Last session` block with a dated entry and add this State Update at the top of `## Next` (keep the remaining items):
```
State Update 2026-10-09: Foundation done on branch `rewrite` (TS+Vitest, v2 store, lossless legacy migration, v1/v2 backups, ported engine with golden tests; read-only /dev.html dry run). App.jsx is still the shipping UI.
Next: Dylan opens /dev.html on the phone (after merge) to confirm counts, then sub-project 2 (design system + shell) with the real persisting migration on first launch.
```
Commit: `git add HANDOFF.md && git commit -m "docs: update handoff after foundation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`

- [ ] **Step 8: Hand off to Dylan**

Report test/typecheck/lint/build output. Ask Dylan before merging `rewrite` into `main` (main auto-deploys). After merge, Dylan opens `https://<site>/dev.html` on the phone and confirms the counts match the app (expected: 41 exercises · 57 sessions).
