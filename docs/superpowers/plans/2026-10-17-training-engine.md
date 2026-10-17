# Training Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the parity-port engine and the v1-shaped data model with the approved design: start-empty boot, the new v2 document (library-based exercises, per-set RIR, phases, per-equipment steps), an exercise library, a pure coaching engine (`targetsFor`, `fatigueSuggestion`) and a weekly volume tracker. No UI.

**Architecture:** Pure TypeScript in `src/domain` (no React, no storage imports). The engine reads a `StoreDoc` plus `today` and returns targets; the only state it reads beyond history is `doc.coaching.fatigueWeeks`. `src/data` keeps one job: load, validate and save the whole v2 document; legacy keys are read only for a raw "download old app data" export.

**Tech Stack:** TypeScript (strict), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-17-training-engine-design.md` (approved 2026-10-17). Read it first; this plan pins the decisions it leaves open.

## Global Constraints

- Branch `rewrite`. Gate for every task: `npm test && npm run typecheck && npm run lint` all pass before the commit.
- Commit messages end with `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- `src/domain/**` imports nothing from `src/data`, React or the DOM.
- Dates are local `YYYY-MM-DD` strings, never `toISOString()` slices. All date math goes through `src/domain/dates.ts`.
- Never write or delete the legacy keys `exercises`, `sessions`, `customGroups`, `settings`. Never touch `fixtures/` (gitignored personal data).
- Every suggested weight for an `external` lift is a multiple of its step (`exercise.step ?? settings.equipmentSteps[exercise.equipment]`) and ≥ one step. Bodyweight added load and assistance are ≥ 0 multiples of the step.
- Style defaults (copied from the spec):
  - strength compound 3–6 reps × 3, RIR 1–2, 180 s, 3 warm-ups; strength isolation 6–10 × 3, RIR 1–2, 120 s, 1 warm-up; strength volume 6–12.
  - hypertrophy compound 6–10 × 3, RIR 0–2, 120 s, 2 warm-ups; hypertrophy isolation 10–15 × 3, RIR 0–2, 90 s, 1 warm-up; hypertrophy volume 10–20.
- Equipment steps lb / kg: barbell, smith, ez-bar, trap-bar 5 / 2.5; dumbbell 5 / 2; machine 10 / 5; cable 5 / 2.5; kettlebell 9 / 4; plate 10 / 5; bodyweight 5 / 2.5; band 0 / 0 (reps only).
- Epley: `e1rm = w × (1 + r/30)`; inverse `repsAt(w, e) = floor(30 × (e/w − 1) + 1e-9)`, and 0 when `w ≤ 0`.
- Week = Sunday–Saturday.
- Reasons are one plain sentence. Exact strings that tests pin are given in the tasks; others are the implementer's wording.

## Review Focus

1. **History weights that aren't on the step grid** (old imports, a changed step override, 22.5 lb on a 5 lb dumbbell): the next weight must be the next grid value above W, never W + step off-grid. Test in Task 3 (`heavier`) and Task 5.
2. **Weight ≤ 0 on an external lift** (an empty-bar entry logged as 0): no division by zero or NaN. Prediction is skipped and the lift earns on reps alone. Test in Task 5.
3. **Two blocks of the same exercise on one day, or sessions dated after `today`:** blocks merge in logged order, and future-dated sessions are ignored by every rule and by volume. Tests in Tasks 4 and 8.
4. **History older than the first phase's start date:** it belongs to the first phase and must not crash `phaseOf`. Test in Task 3.
5. **Unit switch with zero-weight sets and step overrides:** zeros stay 0 and aren't counted as changed, and overrides are cleared. Test in Task 3.

## File Structure

```
src/domain/dates.ts            todayYmd, addDays, daysBetween, weekStart
src/domain/types.ts            (rewrite) new document types
src/domain/settings.ts         (rewrite) STYLE_DEFAULTS, EQUIPMENT_STEPS, defaultSettings, phaseOf, rulesFor, loadStep, grid helpers, convertUnits
src/domain/warmup.ts           (modify) warmupRamp(target, count, step)
src/domain/strength.ts         (modify) effectiveReps, predictE1rm, displayE1rm, repsAt (e1rm kept)
src/domain/entries.ts          (delete) replaced by engine/history.ts
src/domain/progression.ts      (delete) replaced by engine/
src/domain/library/muscles.ts  Muscle labels and regions
src/domain/library/catalog.ts  LIBRARY data (≥150 entries)
src/domain/library/index.ts    searchLibrary, exerciseFromLibrary, customExercise
src/domain/engine/history.ts   liftHistory, LiftSession, beats
src/domain/engine/progress.ts  rules 1, 2, 8, 10, 11
src/domain/engine/setbacks.ts  rules 3, 4, 5
src/domain/engine/returns.ts   rule 7
src/domain/engine/fatigue.ts   rule 6: fatigueSuggestion, decideFatigue, fatigueWindow
src/domain/engine/testday.ts   rule 9: testTargets, bestTest
src/domain/engine/targets.ts   targetsFor: precedence, warm-ups, rest
src/domain/volume.ts           weeklyVolume
src/data/{normalize,store,boot,backup}.ts (rewrite to new shape) · src/data/migrate.ts → src/data/legacy.ts
src/dev/main.ts                (modify) show the new boot result
tests/helpers/build.ts         (new) tiny builders for docs, exercises, sessions
tests/helpers/fixtures.ts      (delete) · tests/golden/ and tests/reference/legacyEngine.js (delete)
```

---

### Task 1: New document model, start-empty boot, v2-only backups

The types change breaks every module that uses them, so the whole switch lands in one task to keep the gate green.

**Files:**
- Create: `src/domain/dates.ts`, `src/data/legacy.ts` (moved from `migrate.ts`), `tests/helpers/build.ts`, `tests/domain/dates.test.ts`
- Rewrite: `src/domain/types.ts`, `src/domain/settings.ts` (defaults only in this task), `src/data/normalize.ts`, `src/data/store.ts`, `src/data/boot.ts`, `src/data/backup.ts`, `tests/data/{normalize,store,boot,backup}.test.ts`, `tests/domain/settings.test.ts`, `tests/domain/warmup.test.ts`
- Modify: `src/domain/warmup.ts`, `src/dev/main.ts`
- Delete: `src/data/migrate.ts`, `src/domain/progression.ts`, `src/domain/entries.ts`, `tests/domain/progression.test.ts`, `tests/domain/entries.test.ts`, `tests/golden/`, `tests/reference/legacyEngine.js`, `tests/helpers/fixtures.ts`

**Interfaces (produces):**
- `dates.ts`: `todayYmd(now?: Date): string` (local parts); `addDays(date: string, n: number): string`; `daysBetween(a: string, b: string): number` (b − a in whole days); `weekStart(date: string): string` (the Sunday on or before `date`). Implement with `new Date(y, m-1, d)` local arithmetic, never UTC.
- `types.ts`: exactly the spec's types (`Equipment`, `Muscle`, `LiftClass`, `LoadKind = "external" | "bodyweight" | "assisted"`, `Exercise`, `SetEntry`, `Block`, `Session`, `Style`, `Phase`, `ClassRules`, `StyleRules`, `Settings`), plus:
  ```ts
  type ThemePref = "system" | "dark" | "light";
  interface FatigueDecision { weekStart: string; status: "accepted" | "dismissed"; decidedOn: string }
  interface StoreDoc { schemaVersion: 2; exercises: Exercise[]; sessions: Session[]; settings: Settings; programs: Program[]; coaching: { fatigueWeeks: FatigueDecision[] } }
  ```
  `Settings.theme` is `ThemePref`. `Program` stays the reserved `{ id; name }`. `customGroups`, `muscleGroup`, `type`, `increment`, `compound`/`isolation` settings, `restTimer` and `rpe` are gone. `EQUIPMENT` and `MUSCLES` are exported `readonly` arrays, so types and validation share one list.
- `settings.ts`: `STYLE_DEFAULTS: Record<Style, StyleRules>` and `EQUIPMENT_STEPS: Record<Unit, Record<Equipment, number>>` (values from Global Constraints); `defaultSettings(today: string, unit?: Unit): Settings` → unit `"lb"`, `phases: [{ id: \`phase-${today}\`, style: "hypertrophy", startDate: today }]`, styles = a deep copy of the defaults, `equipmentSteps = EQUIPMENT_STEPS[unit]`, theme `"system"`.
- `store.ts`: `emptyDoc(today?: string): StoreDoc` (today defaults to `todayYmd()`); `loadDoc`, `saveDoc` and `V2_KEY` keep their current signatures.
- `normalize.ts`: `validateDoc(raw: unknown, warn: Warn): StoreDoc`, with `DataError` and `Warn` unchanged. Rules:
  - required strings and arrays as today;
  - `equipment`, muscles, `class` and `loadKind` must be members of their lists (else `DataError` naming the path, e.g. `exercises[2].primary[0]`); `primary` needs ≥ 1 entry;
  - `step` is a number > 0 or null; `archived` defaults to false; `libraryId` is a string or null;
  - sets: `rir` is null or an integer 0–4 (missing ⇒ null); `block.test` defaults to false; weights and reps follow the existing numeric rules;
  - settings: unit must be lb or kg (else warn and use lb); `phases` must be a non-empty array of valid phases (empty or missing ⇒ warn and use `defaultSettings(earliest session date or today)`.phases); `styles` and `equipmentSteps` are merged field-by-field over the defaults for the unit (non-numeric ⇒ warn and default); theme outside the three values ⇒ `"system"` without a warning;
  - `coaching` defaults to `{ fatigueWeeks: [] }`;
  - orphan blocks are warned about, not dropped.
- `boot.ts`: `bootStore(kv, opts?)` → `{ kind: "v2" | "fresh"; doc; warnings }`. Missing v2 ⇒ `emptyDoc()`, written unless `persist: false`, **regardless of legacy keys**. A corrupt v2 still throws and is never overwritten. `dumpLegacyRaw(kv)` is kept (now importing `LEGACY_KEYS` from `legacy.ts`); new `hasLegacyData(kv): Promise<boolean>`.
- `legacy.ts`: only `LEGACY_KEYS` (`readLegacy` and `legacyToDoc` are deleted).
- `backup.ts`: `exportBackup` unchanged. `parseBackup`: version 1 ⇒ `DataError("This backup is from the old app and can't be imported")`; version 2 ⇒ `validateDoc`; other errors as today. `importBackup` unchanged.
- `warmup.ts`: `warmupRamp(target: number | null, count: number, step: number): { weight: number; reps: number }[]`. Same 45%→90% / 8→3 algorithm, rounding to the nearest multiple of `step`, and returning `[]` when `step ≤ 0`, `count ≤ 0` or the target is missing or ≤ 0.
- `tests/helpers/build.ts` (used by every later task):
  ```ts
  ex(id: string, o?: Partial<Exercise>): Exercise          // defaults: name=id, libraryId=null, equipment "barbell", primary ["chest"], secondary [], class "compound", loadKind "external", step null, archived false
  sets(weight: number, reps: number[], rir?: (number | null)[]): SetEntry[]   // working sets; rir defaults to null
  warm(weight: number, reps: number): SetEntry
  day(date: string, blocks: [exerciseId: string, sets: SetEntry[], test?: boolean][]): Session  // ids derived from date + index
  doc(o: { exercises?: Exercise[]; sessions?: Session[]; style?: Style; phases?: Phase[]; unit?: Unit; today?: string }): StoreDoc
  ```
  `doc` builds on `emptyDoc(o.today ?? "2026-09-01")`. `style` sets a single phase starting 2026-01-01. `phases` overrides it.

- [ ] **Step 1: Write the failing tests**

`tests/domain/dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { addDays, daysBetween, todayYmd, weekStart } from "../../src/domain/dates";

describe("dates", () => {
  it("todayYmd uses local parts", () => {
    expect(todayYmd(new Date(2026, 9, 17, 23, 45))).toBe("2026-10-17");
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("counts whole days", () => {
    expect(daysBetween("2026-09-01", "2026-09-20")).toBe(19);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2); // across a DST change
  });
  it("weeks start on Sunday", () => {
    expect(weekStart("2026-10-14")).toBe("2026-10-11");
    expect(weekStart("2026-10-11")).toBe("2026-10-11");
    expect(weekStart("2026-10-17")).toBe("2026-10-11");
    expect(weekStart("2026-10-18")).toBe("2026-10-18");
  });
});
```

`tests/data/boot.test.ts` (replace):
```ts
// cases (each its own `it`):
// - fresh install writes an empty v2 doc with one hypertrophy phase dated today
// - legacy keys present: kind "fresh", the new doc is empty, legacy values byte-identical,
//   and the only key added is overload.v2 (wrap the KV so any set() on a legacy key throws)
// - persist:false writes nothing
// - an existing valid v2 is returned as kind "v2" and nothing is written
// - a corrupt overload.v2 throws DataError and stays "{corrupt"
// - dumpLegacyRaw returns only legacy keys; hasLegacyData is true with any legacy key and false without
```
`tests/data/normalize.test.ts` (replace). One valid doc built with `build.ts` passes and round-trips; each of these throws a `DataError` whose message names the path: unknown equipment, unknown muscle, empty `primary`, `rir: 5`, `rir: 1.5`, `step: 0`. Defaults get filled: a set without `rir` ⇒ null; a block without `test` ⇒ false; an exercise without `archived` ⇒ false; theme `"ember"` ⇒ `"system"`; `phases: []` ⇒ one hypertrophy phase dated at the earliest session date, with a warning; a non-numeric `styles.strength.compound.repLow` ⇒ 3, with a warning.
`tests/data/backup.test.ts` (replace): a v2 export round-trips through `parseBackup` to an equal doc; a v1 file throws exactly `"This backup is from the old app and can't be imported"`; non-JSON ⇒ `"Backup file is not valid JSON"`; `{hello:1}` ⇒ `"Not an Overload backup file"`.
`tests/data/store.test.ts`: keep the existing cases, built on `emptyDoc("2026-09-01")`.
`tests/domain/settings.test.ts` (replace): `defaultSettings("2026-09-01")` has the exact style and step values from Global Constraints (assert the two style objects and `EQUIPMENT_STEPS.kg.dumbbell === 2`), and mutating the result doesn't change `STYLE_DEFAULTS`.
`tests/domain/warmup.test.ts` (replace):
```ts
expect(warmupRamp(230, 2, 5)).toEqual([{ weight: 105, reps: 8 }, { weight: 205, reps: 3 }]);
expect(warmupRamp(200, 1, 5)).toEqual([{ weight: 120, reps: 6 }]);   // single set sits at t = 0.33 (~60%)
expect(warmupRamp(null, 2, 5)).toEqual([]);
expect(warmupRamp(200, 0, 5)).toEqual([]);
expect(warmupRamp(200, 2, 0)).toEqual([]);
expect(warmupRamp(10, 2, 5)).toEqual([{ weight: 5, reps: 8 }]);       // drops sets that round to 0 or reach the target
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/domain tests/data`
Expected: FAIL. Modules or exports are missing, and the types don't match.

- [ ] **Step 3: Implement** everything in this task's Interfaces block. Delete the files listed above. Update `src/dev/main.ts`: drop the increment line; print `Result: ${kind}`, the exercise and session counts, the unit and current style, and `Old app data on this device: yes/no` from `hasLegacyData`. Its raw-download button uses `dumpLegacyRaw`.

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. Nothing references `progression`, `entries`, `migrate`, `fixtures`, `customGroups`, `muscleGroup` or `increment` any more. Check with `grep -rnE "progression|domain/entries|migrate|helpers/fixtures|customGroups|muscleGroup|increment" src tests`, which should print nothing.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(data): new v2 document model, start-empty boot and v2-only backups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Exercise library and custom exercises

**Files:**
- Create: `src/domain/library/muscles.ts`, `src/domain/library/catalog.ts`, `src/domain/library/index.ts`, `tests/domain/library.test.ts`

**Interfaces:**
- Consumes: `Equipment`, `Muscle`, `LiftClass`, `LoadKind`, `Exercise`, `EQUIPMENT`, `MUSCLES` (Task 1).
- Produces:
  - `MUSCLE_LABEL: Record<Muscle, string>`. Labels are the slug in sentence case with spaces ("Front delts", "Upper back", "Lower back", "Side delts", "Rear delts"); single words are capitalized.
  - `REGION_OF: Record<Muscle, "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core">`. Chest: chest. Back: lats, upper-back, traps, lower-back. Shoulders: the three delts. Arms: biceps, triceps, forearms. Legs: quads, hamstrings, glutes, adductors, abductors, calves. Core: abs, obliques.
  - `interface LibraryExercise` (as in the spec, with `loadKind`) and `LIBRARY: readonly LibraryExercise[]`.
  - `searchLibrary(query: string): LibraryExercise[]`. Case-insensitive. Every whitespace-separated token must appear in the name, movement or an alias. Results are sorted by movement, then name. An empty query returns everything.
  - `exerciseFromLibrary(entry: LibraryExercise, id: string): Exercise`. Copies name, equipment, muscles, class and loadKind; `libraryId = entry.id`; `step` null; `archived` false.
  - `customExercise(input: { name: string; equipment: Equipment; primary: Muscle[]; secondary?: Muscle[]; class: LiftClass; step?: number | null }, id: string): Exercise | { error: string }`. The name is trimmed. Errors: `"Name can't be empty"`, `"Pick at least one muscle worked"`, `"Step must be more than 0"`. `loadKind` is `"bodyweight"` when the equipment is bodyweight, else `"external"`; a secondary muscle that's also primary is removed from secondary.

Catalog rules:
- **Coverage:** every movement × equipment combination listed under "Exercise library content" in the spec, **≥ 150 entries**.
- **Ids:** `"<movement-slug>.<equipment>"`, with a variant slug in the movement part when needed (`"lat-pulldown-close.cable"`, `"incline-bench-press.dumbbell"`).
- **Names:** `"<Movement> (<equipment label>)"`. Labels: barbell, dumbbell, machine, cable, Smith machine, EZ bar, trap bar, kettlebell, bodyweight, band, plate.
- **Assisted machines** (assisted pull-up, assisted dip) use equipment `machine`, `loadKind: "assisted"`, and names like `"Pull-up (assisted)"`.
- **Weighted variants.** The spec's weighted pull-up, dip, push-up and back extension are **not** separate entries. The bodyweight entry covers them, since its weight means added load, and gets aliases like `"weighted pull-up"`.

- [ ] **Step 1: Write the failing test `tests/domain/library.test.ts`**
```ts
// integrity
it("has at least 150 entries with unique ids", ...);           // LIBRARY.length >= 150; new Set(ids).size === length
it("every entry is well-formed", ...);                          // primary.length >= 1; all muscles in MUSCLES; equipment in EQUIPMENT;
                                                                // class in ["compound","isolation"]; name matches /^[A-Z].* \(.+\)$/; id matches /^[a-z0-9-]+\.[a-z-]+$/
it("covers the owner's examples", ...);                          // ids exist: bench-press.{barbell,dumbbell,machine,smith}, incline-bench-press.{barbell,dumbbell,machine,smith},
                                                                // curl.{barbell,ez-bar,dumbbell,cable,machine}, lateral-raise.{dumbbell,cable,machine}
it("pins a few muscle maps", ...);                              // bench-press.barbell: primary ["chest"], secondary ⊇ ["front-delts","triceps"], compound
                                                                // lateral-raise.dumbbell: primary ["side-delts"], isolation; pull-up.bodyweight: loadKind "bodyweight", primary ⊇ ["lats"]
                                                                // pull-up.machine (assisted): loadKind "assisted"
// search
expect(searchLibrary("db bench").map((e) => e.id)).toContain("bench-press.dumbbell");
const ez = searchLibrary("CURL ez");
expect(ez.map((e) => e.id)).toContain("curl.ez-bar");
expect(ez.every((e) => e.equipment === "ez-bar" && /curl/i.test(e.movement))).toBe(true);
expect(searchLibrary("")).toHaveLength(LIBRARY.length);
// custom
expect(customExercise({ name: "  Landmine press ", equipment: "barbell", primary: ["front-delts", "chest"], secondary: ["chest", "triceps"], class: "compound" }, "x"))
  .toEqual({ id: "x", libraryId: null, name: "Landmine press", equipment: "barbell", primary: ["front-delts", "chest"], secondary: ["triceps"],
             class: "compound", loadKind: "external", step: null, archived: false });
expect(customExercise({ name: " ", equipment: "cable", primary: ["chest"], class: "isolation" }, "x")).toEqual({ error: "Name can't be empty" });
expect(customExercise({ name: "Thing", equipment: "cable", primary: [], class: "isolation" }, "x")).toEqual({ error: "Pick at least one muscle worked" });
expect(customExercise({ name: "Thing", equipment: "cable", primary: ["abs"], class: "isolation", step: 0 }, "x")).toEqual({ error: "Step must be more than 0" });
```

- [ ] **Step 2: Run it and confirm it fails**: `npx vitest run tests/domain/library.test.ts`. Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement** the three files. Muscle assignments follow common training references. Use one primary muscle for isolation lifts, and the main movers as primary for compounds (rows: lats + upper-back; squats: quads + glutes; RDL: hamstrings + glutes; overhead press: front-delts).

- [ ] **Step 4: Run the gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(domain): add exercise library, muscle map and custom exercises" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Phases, rules lookup, load steps and unit conversion

**Files:**
- Modify: `src/domain/settings.ts`
- Test: `tests/domain/settings.test.ts` (append)

**Interfaces (produces):**
- `phaseOf(settings: Settings, date: string): Phase`: the phase with the latest `startDate ≤ date`. Dates before every phase belong to the earliest phase.
- `rulesFor(ex: Exercise, settings: Settings, date: string): ClassRules & { volume: { low: number; high: number }; style: Style }`
- `loadStep(ex: Exercise, settings: Settings): number`: `ex.step ?? settings.equipmentSteps[ex.equipment]`
- `floorTo(w: number, step: number): number`, `nearestTo(w, step)`: floor / round to a multiple, with `1e-9` tolerance.
- `heavier(ex, w, step, n = 1): number`:
  - external: `floorTo(w, step) + n·step` (the next grid value above an off-grid W);
  - bodyweight: `max(0, floorTo(w, step)) + n·step`;
  - assisted: `max(0, floorTo(w, step) − n·step)`.
- `lighter(ex, w, step, opts: { pct?: number; steps?: number }): number`:
  - external: `max(step, floorTo(w × (pct ?? 1) − (steps ?? 0)·step, step))`;
  - bodyweight: `max(0, w − (steps ?? 1)·step)`;
  - assisted: `w + (steps ?? 1)·step`.
  - The `pct` option applies to external only; bodyweight and assisted ignore it and use steps (spec rule 10).
- `convertUnits(doc: StoreDoc, to: Unit): { doc: StoreDoc; changedSets: number }`:
  - every set weight is multiplied by 0.4536 (lb→kg) or 2.2046 (kg→lb) and rounded to 0.1;
  - `changedSets` counts sets whose weight ≠ 0;
  - `equipmentSteps` become `EQUIPMENT_STEPS[to]`, every `exercise.step` becomes null, and `unit` becomes `to`;
  - if `to` is already the doc's unit, it returns the same doc with 0.

- [ ] **Step 1: Write the failing tests** (append):
```ts
const phases = [{ id: "a", style: "hypertrophy", startDate: "2026-09-01" }, { id: "b", style: "strength", startDate: "2026-10-01" }] as const;
expect(phaseOf({ ...s, phases: [...phases] }, "2026-10-01").id).toBe("b");
expect(phaseOf({ ...s, phases: [...phases] }, "2026-09-30").id).toBe("a");
expect(phaseOf({ ...s, phases: [...phases] }, "2026-01-01").id).toBe("a");          // before every phase → earliest
expect(rulesFor(ex("sq"), { ...s, phases: [...phases] }, "2026-10-05")).toMatchObject({ style: "strength", repLow: 3, repHigh: 6, sets: 3, restSeconds: 180, volume: { low: 6, high: 12 } });
expect(loadStep(ex("db", { equipment: "dumbbell" }), s)).toBe(5);
expect(loadStep(ex("db", { equipment: "dumbbell", step: 2.5 }), s)).toBe(2.5);
expect(heavier(ex("a"), 222.5, 5)).toBe(225);                                        // off-grid W → next grid value
expect(heavier(ex("a"), 225, 5, 2)).toBe(235);
expect(heavier(ex("p", { loadKind: "bodyweight" }), 0, 5)).toBe(5);
expect(heavier(ex("p", { loadKind: "assisted" }), 40, 5)).toBe(35);
expect(heavier(ex("p", { loadKind: "assisted" }), 0, 5)).toBe(0);
expect(lighter(ex("a"), 225, 5, { pct: 0.9 })).toBe(200);                             // 202.5 → 200
expect(lighter(ex("a"), 225, 5, { steps: 1 })).toBe(220);
expect(lighter(ex("a"), 5, 5, { pct: 0.9 })).toBe(5);                                 // never below one step
expect(lighter(ex("p", { loadKind: "bodyweight" }), 0, 5, { pct: 0.9 })).toBe(0);
expect(lighter(ex("p", { loadKind: "assisted" }), 40, 5, { steps: 2 })).toBe(50);
// convertUnits
const d = doc({ exercises: [ex("a", { step: 2.5 })], sessions: [day("2026-09-02", [["a", [...sets(225, [5]), ...sets(0, [10])]]])] });
const r = convertUnits(d, "kg");
expect(r.changedSets).toBe(1);
expect(r.doc.sessions[0]!.blocks[0]!.sets.map((x) => x.weight)).toEqual([102.1, 0]);
expect(r.doc.settings.equipmentSteps.dumbbell).toBe(2);
expect(r.doc.exercises[0]!.step).toBeNull();
expect(convertUnits(r.doc, "lb").doc.sessions[0]!.blocks[0]!.sets[0]!.weight).toBe(225.1);  // 102.1 × 2.2046 = 225.09…, documented drift
expect(convertUnits(d, "lb")).toEqual({ doc: d, changedSets: 0 });
```

- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain/settings.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `settings.ts`.
- [ ] **Step 4: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -am "feat(domain): add phases, rules lookup, load-step grid and unit conversion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 4: Estimates and lift history

**Files:**
- Modify: `src/domain/strength.ts` · Create: `src/domain/engine/history.ts`
- Test: `tests/domain/strength.test.ts` (rewrite), `tests/domain/history.test.ts`

**Interfaces (produces):**
- `effectiveReps(s: SetEntry): number`: `reps + (rir ?? 0)`, where rir 4 means "4+" and counts as 4.
- `predictE1rm(s: SetEntry): number`: uncapped Epley on effective reps, unrounded. Returns 0 if weight ≤ 0.
- `displayE1rm(sets: SetEntry[]): number`: the best Epley value over working sets with effective reps ≤ 12. If none qualify, effective reps are capped at 12. Rounded to an integer. 0 when there are no working sets. `e1rm(weight, reps)` stays as is.
- `repsAt(weight: number, e: number): number`: `floor(30 × (e/weight − 1) + 1e-9)`; 0 if weight ≤ 0 or the result is < 0.
- `history.ts`:
  ```ts
  interface LiftSession { date: string; phaseId: string; sets: SetEntry[]; W: number; atW: SetEntry[]; best: number }
  // sets = working (non-warm-up) sets of all non-test blocks of the exercise that day, in logged order;
  // W = max weight among them; atW = sets at exactly W (logged order); best = max reps in atW
  function liftHistory(doc: StoreDoc, exerciseId: string, today: string): LiftSession[]   // newest first; dates ≤ today; days with no working sets skipped
  function beats(a: { W: number; best: number }, b: { W: number; best: number }): boolean // heavier, or same W and more reps
  ```

- [ ] **Step 1: Write the failing tests**
```ts
expect(effectiveReps({ weight: 100, reps: 8, warmup: false, rir: 2 })).toBe(10);
expect(predictE1rm({ weight: 225, reps: 10, warmup: false, rir: 1 })).toBeCloseTo(307.5);
expect(predictE1rm({ weight: 15, reps: 21, warmup: false, rir: 0 })).toBeCloseTo(25.5);   // uncapped
expect(displayE1rm(sets(15, [21, 21], [0, 0]))).toBe(21);   // capped at 12: 15 × 1.4
expect(displayE1rm(sets(225, [5], [1]))).toBe(270);
expect(repsAt(230, 307.5)).toBe(10);
expect(repsAt(20, 25.5)).toBe(8);
expect(repsAt(225, 307.5)).toBe(11);                         // exact boundary, needs the epsilon
expect(repsAt(0, 300)).toBe(0);
// liftHistory
const d = doc({ exercises: [ex("a")], sessions: [
  day("2026-09-01", [["a", [warm(45, 8), ...sets(100, [8, 8])]]]),
  day("2026-09-03", [["a", sets(100, [9])], ["a", sets(110, [5])]]),   // two blocks the same day → merged in order
  day("2026-09-04", [["a", sets(130, [1]), true]]),                     // test block → skipped
  day("2026-09-05", [["a", [warm(45, 8)]]]),                            // warm-up only → skipped
  day("2026-12-01", [["a", sets(200, [5])]]),                           // after today → skipped
] });
const h = liftHistory(d, "a", "2026-09-10");
expect(h.map((x) => x.date)).toEqual(["2026-09-03", "2026-09-01"]);
expect(h[0]).toMatchObject({ W: 110, best: 5 });
expect(h[0]!.sets.map((s) => s.weight)).toEqual([100, 110]);
expect(h[1]).toMatchObject({ W: 100, best: 8 });
expect(beats({ W: 105, best: 1 }, { W: 100, best: 9 })).toBe(true);
expect(beats({ W: 100, best: 9 }, { W: 100, best: 9 })).toBe(false);
```
- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain/strength.test.ts tests/domain/history.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(engine): add strength estimates and lift history" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: `targetsFor` with progression rules (1, 2, 8, 10, 11), warm-ups and rest

**Files:**
- Create: `src/domain/engine/progress.ts`, `src/domain/engine/targets.ts`, `tests/domain/engine/progress.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3 and 4.
- Produces:
  ```ts
  type Rule = "first-time" | "earn" | "earn-double" | "extend-reps" | "build-reps" | "repeat" | "drop" | "stall-deload"
            | "stall-volume" | "fatigue-week" | "return" | "phase-start" | "test-day";
  interface SetTarget { reps: number; rirLow: number; rirHigh: number }
  interface LiftTargets { exerciseId: string; rule: Rule; weight: number | null; sets: SetTarget[]; ladder?: number[];
                          warmups: { weight: number; reps: number }[]; reason: string; restSeconds: number }
  function targetsFor(exerciseId: string, doc: StoreDoc, today: string, opts?: { test?: boolean }): LiftTargets
  // progress.ts (used by later tasks)
  function progressTargets(ex: Exercise, h: LiftSession[], rules: ClassRules, step: number, prevSameW?: LiftSession): { rule: Rule; weight: number | null; reps: number[]; reason: string }
  function buildReps(last: LiftSession, rules: ClassRules, prevSameW?: LiftSession, uncapped?: boolean): number[]   // rule 2 on one session
  ```
  `targetsFor` throws `Error("Unknown exercise <id>")` for an unknown id. It turns `reps[]` into `SetTarget`s using the style's RIR range, sets `restSeconds = rules.restSeconds`, and sets `warmups = warmupRamp(weight, rules.warmupSets, step)` for external lifts with a weight (otherwise `[]`).

Rule details. `last = h[0]`; `n = rules.sets`; the earn ceiling is `repHigh + 6`.
- **11 first-time** (`h` empty): weight null, reps `n × repLow`. Reason: `` `First time: pick a weight you can lift for ${repLow}–${repHigh} reps with ${rirLow}–${rirHigh} left.` ``
- **8 phase-start** (`h` non-empty but no session with the current `phaseId`). For external lifts: `e = max predictE1rm over last.atW`. Start at `weight = W` and, while `weight > step` and `repsAt(weight, e) < repLow`, subtract one step. Reps are `n × clamp(repsAt(weight, e) − rirHigh, repLow, repHigh)`. For bodyweight and assisted lifts: weight W, reps `n × clamp(last.best, repLow, repHigh)`.
- **1 earn**, for an external lift with W > 0, when `last.atW` has ≥ n sets with reps ≥ repHigh:
  - let `e = max predictE1rm(atW)`;
  - if every set at W has rir ≥ 3 and `repsAt(heavier(W, 2), e) ≥ repLow` ⇒ `earn-double`, weight `heavier(W, 2)`;
  - else if `repsAt(heavier(W), e) ≥ repLow`, or the minimum reps at W ≥ the ceiling ⇒ `earn`, weight `heavier(W)`;
  - else ⇒ `extend-reps`: weight W, reps `n × min(ceiling, min reps at W + 1)`, reason `` `${heavier(W)} ${unit} is a big jump from ${W} ${unit}, so build to ${ceiling} reps here first.` ``;
  - after an earn, reps are `n × repLow`.
  - Bodyweight and assisted lifts, and external lifts with W ≤ 0, earn on the reps test alone (no prediction, double or extend), with weight `heavier(W)`.
  - Band (equipment `band`): it never earns, weight is always null, and reps are built uncapped. When `last.best > repHigh + 5`, the reason is `` `Reps are past ${repHigh + 5}, so move to the next band.` ``
- **2 build-reps**, otherwise:
  - the base is `last.atW` reps, padded to n with the last value (extras beyond n are dropped);
  - bump the lowest value below repHigh (the first such index) by 1, capped at repHigh; for bands, bump the lowest value (first such index) regardless of repHigh, uncapped;
  - if every set at W is rated, the bump becomes 2 when their average rir is > rirHigh;
  - there's no bump when their average rir is < rirLow **and** `prevSameW` exists with the same W and a larger reps sum;
  - weight W (null for bands).

- [ ] **Step 1: Write the failing tests** `tests/domain/engine/progress.test.ts`. Every case uses `today = "2026-10-20"` and a single phase from 2026-01-01; the style is hypertrophy unless stated.

| case | exercise | history (newest last) | expect |
|---|---|---|---|
| first time | barbell | none | rule first-time, weight null, reps [6,6,6], reason "First time: pick a weight you can lift for 6–10 reps with 0–2 left." |
| earn | barbell | 10-01 225×[10,10,10] rir 1 | earn, 230, [6,6,6], warmups [{105,8},{205,3}], rest 120 |
| earn double | barbell | 10-01 225×[10,10,10] rir 3 | earn-double, 235, [6,6,6] |
| off-grid W | barbell | 10-01 222.5×[10,10,10] rir 1 | earn, 225 |
| too few sets | barbell | 10-01 225×[10,10] | build-reps, 225, [10,10,10] |
| extend | dumbbell, isolation | 10-01 15×[15,15,15] rir 0 | extend-reps, 15, [16,16,16], reason "20 lb is a big jump from 15 lb, so build to 21 reps here first." |
| extend uneven | dumbbell, isolation | 10-01 15×[18,17,17] rir 0 | extend-reps, [18,18,18] |
| ceiling | dumbbell, isolation | 10-01 15×[21,21,21] rir 0 | earn, 20, [10,10,10] |
| build | barbell | 10-01 225×[8,7,7] rir 2 | build-reps, 225, [8,8,7] |
| build easy | barbell | 10-01 225×[8,7,7] rir 3 | [8,9,7] |
| pad sets | barbell | 10-01 225×[8,8] | [9,8,8] |
| hold (strength) | barbell, style strength | 09-28 200×[5,5,4]; 10-01 200×[5,4,4] rir 0 | build-reps, 200, [5,4,4] |
| W = 0 external | barbell | 10-01 0×[10,10,10] | earn, 5 |
| bodyweight | bodyweight, loadKind bodyweight | 10-01 0×[10,10,10] | earn, 5, [6,6,6], warmups [] |
| assisted | machine, loadKind assisted | 10-01 40×[10,10,10] | earn, 35 |
| band | band, isolation | 10-01 0×[21,21,21] | build-reps, null, [22,21,21], reason "Reps are past 20, so move to the next band." |
| phase start → strength | barbell; phases hyp 09-01, strength 10-01; today 10-03 | 09-20 225×[10,10,10] rir 1 | phase-start, 225, [6,6,6] |
| phase start → hypertrophy, step down | barbell; phases strength 09-01, hyp 10-01; today 10-03 | 09-25 200×[3,3,3] rir 0 | phase-start, 180, [6,6,6] |
| unknown id | | | `targetsFor("nope", …)` throws "Unknown exercise nope" |

- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain/engine/progress.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `progress.ts` and `targets.ts`. In this task, `targetsFor`'s precedence is: first-time → phase-start → earn/extend → build. Later tasks insert their rules at the positions given in Task 7.
- [ ] **Step 4: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(engine): add targetsFor with step-aware progression" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 6: Setbacks: bad sessions, drops and stalls (rules 3, 4, 5)

**Files:**
- Create: `src/domain/engine/setbacks.ts`, `tests/domain/engine/setbacks.test.ts` · Modify: `src/domain/engine/targets.ts`

**Interfaces (produces):**
```ts
function isBad(cur: LiftSession, prev: LiftSession | undefined, rules: ClassRules): boolean
// true only if prev exists with prev.W === cur.W and prev.phaseId === cur.phaseId,
// and (cur.best <= prev.best - 2 || cur.atW[0].reps < rules.repLow)
function stallFireIndex(hPhase: LiftSession[]): number | null
// hPhase = the current phase's sessions, newest first. Walk chronologically (oldest→newest). For each prefix ending at
// chronological index j: stalled(prefix) = prefix.length >= 4 && none of the newest 3 beat the best of the older ones
// && (avg rir over rated sets at W in the newest 3 <= 1, or no rated sets). It fires at j when stalled and
// j >= lastFire + 4 (lastFire starts at -Infinity). Returns the newest fire's position in hPhase (0 = newest), or null.
```
Rules applied in `targetsFor` (precedence slots are in Task 7):
- **4 drop:** `isBad(h[0], h[1])` and `isBad(h[1], h[2])` ⇒ weight `lighter(W, {steps: 1})`, reps `n × repLow`. Reason: `` `Two off sessions in a row, so drop to ${weight} ${unit} and rebuild.` ``
- **5 stall:** let `k = stallFireIndex(hPhase)`.
  - `k === 0` and the style is strength ⇒ `stall-deload`, weight `lighter(W, {pct: 0.9})` (bodyweight and assisted: `{steps: 1}`), reps `n × repHigh`.
  - The style is hypertrophy, `k !== null` and `daysBetween(hPhase[k].date, today) ≤ 7` ⇒ `stall-volume`: weight W, reps `buildReps(h[0], …)` truncated to `ceil(n / 2)` sets.
  - Reason: `` `No progress on ${ex.name} in 3 sessions.` `` (for stall-volume, add `" Half the sets this week."`).
- **3 repeat:** `isBad(h[0], h[1])` ⇒ `repeat`: weight `h[1].W`, reps `buildReps(h[1], rules)`. Reason exactly: `"Last session was off, so same weight, try again."`

- [ ] **Step 1: Write the failing tests** (hypertrophy compound barbell unless stated; one phase from 2026-01-01; today two days after the last session):

| case | history (oldest → newest) | expect |
|---|---|---|
| one bad, reps fell 2 | 225×[8,8,8]; 225×[6,6,6] | repeat, 225, [9,8,8] |
| one bad, first set under range | 225×[8,8,8]; 225×[5,8,8] | repeat |
| different W not compared | 225×[8,8,8]; 230×[6,6,6] | build-reps, 230, [7,6,6] |
| different phase not compared | phases A (hypertrophy, 2026-01-01) and B (hypertrophy, starting on the second session's date); 225×[8,8,8]; 225×[6,6,6] | build-reps, 225, [7,6,6] |
| two bad | 225×[9,9,9]; 225×[7,7,7]; 225×[5,5,5] | drop, 220, [6,6,6] |
| stall, strength | 4 × 200×[5,5,5] rir 0 (10-01, 04, 07, 10), strength | stall-deload, 180, [6,6,6] |
| stall, unrated | same, rir null | stall-deload |
| no stall when easy | same, rir 3 | build-reps, [6,5,5] |
| cooldown | 4 stalled (10-01…10-10), then 10-13 180×[6,6,6], 10-16 200×[5,5,5], 10-19 200×[5,5,5] rir 0; today 10-21 | not a stall rule (build-reps) |
| fires again after cooldown | the cooldown history plus 10-22 200×[5,5,5] rir 0; today 10-24 | stall-deload |
| hypertrophy half sets | 4 × 100×[8,8,8] rir 0 (10-01…10-10), today 10-12 | stall-volume, 100, 2 sets [9,8] |
| window holds | that history plus 10-13 100×[8,8]; today 10-15 | stall-volume |
| window ends | same; today 10-18 | not stall-volume |

Also test `isBad` and `stallFireIndex` directly for the cooldown case: fires at chronological index 3, not at 5 or 6, and again at 7.

- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain/engine/setbacks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS (Task 5's tests too).
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(engine): add bad-session, drop and stall rules with cooldown" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 7: Time off, fatigue week, test day and the final precedence

**Files:**
- Create: `src/domain/engine/returns.ts`, `src/domain/engine/fatigue.ts`, `src/domain/engine/testday.ts`, `tests/domain/engine/{returns,fatigue,testday,scenarios}.test.ts`
- Modify: `src/domain/engine/targets.ts`

**Interfaces (produces):**
```ts
// returns.ts — rule 7
function returnTargets(ex, h: LiftSession[], today: string, step: number, rules: ClassRules): { weight: number; reason: string } | null
// gap = daysBetween(h[0].date, today). gap >= 28 → lighter(W, {pct: 0.8}) (bodyweight and assisted: {steps: 2}); gap >= 14 → {pct: 0.9} ({steps: 1}).
// Ramp: if daysBetween(h[1].date, h[0].date) >= 14 and h[0].W < h[1].W → nearestTo((h[0].W + h[1].W) / 2, step).
//       else if daysBetween(h[2].date, h[1].date) >= 14 and h[1].W < h[2].W and h[0].W < h[2].W → h[2].W.
// Reps are n × repLow. Reasons: "Welcome back — starting lighter after <gap> days off." / "Building back to <W> <unit>."
// fatigue.ts — rule 6
function fatigueSuggestion(doc: StoreDoc, today: string): { weekStart: string; reason: string } | null
// lifts = distinct exercises with a non-test working set dated in [weekStart(today), today]; needs >= 4.
// bad = lifts whose newest session this week isBad versus its previous session; suggests when bad * 2 >= lifts,
// unless doc.coaching.fatigueWeeks already has this weekStart. Reason exactly: "Most lifts were down this week — take a lighter week?"
function decideFatigue(doc: StoreDoc, weekStart: string, status: "accepted" | "dismissed", today: string): StoreDoc  // replaces any entry for that week
function fatigueActive(doc: StoreDoc, date: string): boolean   // an accepted entry with decidedOn <= date <= addDays(decidedOn, 6)
// testday.ts — rule 9
function testTargets(ex, doc: StoreDoc, today: string, step: number): Pick<LiftTargets, "rule" | "weight" | "ladder" | "sets" | "reason">
// e = max displayE1rm over the 3 newest LiftSessions. ladder = [0.8, 0.88, 0.95].map(p => max(step, floorTo(e * p, step))).
// weight = the last ladder value; sets = 3 × { reps: 1, rirLow: 1, rirHigh: 2 }. With no history: weight null, ladder [],
// reason "Log a few sessions of this lift first, so there's a max to test."
function bestTest(doc: StoreDoc, exerciseId: string): { weight: number; reps: number; date: string; e1rm: number } | null  // best displayE1rm over test blocks
```
**Final precedence in `targetsFor`** (the first match wins):
1. test day (`opts.test`, external lifts only; ignored for bodyweight, assisted and band);
2. first-time;
3. fatigue week (`fatigueActive(doc, today)`): weight `lighter(W, {pct: 0.9})` (bodyweight and assisted: `{steps: 1}`), reps `ceil(n/2) × repLow`, reason "Lighter week: 90% and half the sets.";
4. return (rule 7);
5. phase-start;
6. drop (rule 4);
7. stall (rule 5);
8. repeat (rule 3);
9. earn / extend;
10. build.

- [ ] **Step 1: Write the failing tests**
  - **returns** (hypertrophy compound barbell, step 5):
    - 09-01 225×[8,8,8], today 09-20 ⇒ return, 200, [6,6,6];
    - today 10-01 (30 days) ⇒ return, 180;
    - 09-01 225×[8,8,8], 09-20 200×[6,6,6], today 09-23 ⇒ return, 215;
    - plus 09-23 215×[6,6,6], today 09-26 ⇒ return, 225;
    - plus 09-26 225×[6,6,6], today 09-29 ⇒ build-reps, [7,6,6];
    - assisted 40 lb, 20 days off ⇒ 45;
    - bodyweight W 0, 20 days off ⇒ weight 0, [6,6,6].
  - **fatigue:** four barbell exercises A–D. Each has 10-05 100×[8,8,8]. On 10-12, A and B do 100×[6,6,6] and C and D do 100×[8,8,8]. Today 10-14 ⇒ `{ weekStart: "2026-10-11", reason: "Most lifts were down this week — take a lighter week?" }`.
    - Only A–C trained ⇒ null.
    - After `decideFatigue(…, "dismissed", "2026-10-14")` ⇒ null.
    - After `"accepted"` on 10-14, `targetsFor("A", d, "2026-10-16")` ⇒ fatigue-week, 90, [6,6]; on 10-21 ⇒ not fatigue-week.
    - `decideFatigue` twice for the same week leaves one entry.
  - **testday:** 10-01 225×[5,5,5] rir 1, today 10-03, `{ test: true }` ⇒ test-day, ladder [215, 235, 255], weight 255, 3 sets of 1.
    - A logged test block on 10-03 (255×[1]) doesn't change `targetsFor` on 10-05 without `test`: build-reps from the 10-01 session gives [6,5,5] at 225 under strength, or a phase-start depending on phases. Use a strength phase from 2026-01-01 and expect [6,5,5].
    - `bestTest` ⇒ `{ weight: 255, reps: 1, date: "2026-10-03", e1rm: 264 }`.
    - No history + test ⇒ weight null, ladder [].
    - Bodyweight with `{ test: true }` ⇒ not test-day.
  - **scenarios** (one `it` each, ~8 sessions simulated by logging exactly what `targetsFor` suggests and asserting the rule sequence):
    - steady hypertrophy squat: build, build, … earn;
    - lateral raise extend to ceiling, then earn;
    - strength stall, deload, rebuild;
    - layoff, return ramp, normal;
    - phase change mid-run produces phase-start once.
- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain/engine`. Expected: FAIL in the new files.
- [ ] **Step 3: Implement** the three modules and wire the precedence.
- [ ] **Step 4: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(engine): add time-off ramp, fatigue week, test day and final precedence" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 8: Weekly volume tracker

**Files:**
- Create: `src/domain/volume.ts`, `tests/domain/volume.test.ts`

**Interfaces (produces):**
```ts
interface VolumeRow { muscle: Muscle; label: string; region: string; sets: number; low: number; high: number;
                      status: "under" | "in" | "over"; suggestion: string | null }
function weeklyVolume(doc: StoreDoc, today: string): VolumeRow[]
```
- Counts working (non-warm-up) sets, test blocks included, in sessions dated `weekStart(today) … today`: +1 per primary muscle, +0.5 per secondary. Unknown exercise ids are skipped. Archived exercises still count.
- Range = the current phase style's `volume`.
- Rows: only muscles with any working set in the 28 days ending today. (The spec's "or below range" clause would list every untrained muscle, which defeats its purpose of not nagging, so it's dropped; Task 9 fixes the spec line.)
- Order: under (largest `low − sets` first), then over (largest `sets − high` first), then in-range. Ties break alphabetically by label.
- Text:
  - under: `` `${label}: ${fmt(sets)} of ${low}–${high} this week — add ${Math.ceil(low - sets)}` ``
  - over: `` `${label}: ${fmt(sets)}, above ${high} — consider fewer next week` ``
  - in-range: null
  - `fmt` prints integers plainly and halves as `6.5`.

- [ ] **Step 1: Write the failing test.** Hypertrophy phase. Exercises:
  - bench: primary chest; secondary front-delts, triceps.
  - lat: dumbbell lateral, primary side-delts.
  - curl: primary biceps.
  - leg: primary quads.

  Sessions:
  - 10-01: curl 3 sets.
  - 10-10 (last week): bench 3 sets.
  - 10-12: bench `[warm(45,8), warm(95,5), ...sets(135,[8,8,8])]`, lat 3 sets, leg 21 sets.
  - 10-13: bench test block 1 set.
  - 10-20: bench 3 sets (future).

  Today 10-14:
  ```ts
  const rows = weeklyVolume(d, "2026-10-14");
  expect(rows.map((r) => [r.label, r.sets])).toEqual([
    ["Biceps", 0], ["Front delts", 2], ["Triceps", 2], ["Side delts", 3], ["Chest", 4], ["Quads", 21],
  ]);
  expect(rows[0]!.suggestion).toBe("Biceps: 0 of 10–20 this week — add 10");
  expect(rows.find((r) => r.label === "Chest")!.suggestion).toBe("Chest: 4 of 10–20 this week — add 6");
  expect(rows.at(-1)!.suggestion).toBe("Quads: 21, above 20 — consider fewer next week");
  ```
  A second case: a secondary-only muscle with 3 sets shows `"Triceps: 1.5 of 10–20 this week — add 9"`. A third: on Sunday 10-18 the week resets, so bench sets logged 10-12 no longer count.
- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain/volume.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(domain): add weekly per-muscle volume tracker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 9: Verification, spec touch-up and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-training-engine-design.md` (volume bullet), `HANDOFF.md`

- [ ] **Step 1: Full gate and build**
  - Run: `npm test && npm run typecheck && npm run lint && npm run build`
  - Expected: all pass. `dist/dev.html` exists, and `dist/index.html` (the old app, untouched) still builds.
- [ ] **Step 2: Boundary check.**
  - Run: `grep -rnE "from \"(\.\./)+data|react|document\.|window\." src/domain`. Expected: no output.
  - Run: `git diff --stat main -- src/App.jsx src/storage.js index.html`. Expected: no changes (the old app is untouched).
- [ ] **Step 3: Spec touch-up.** In the volume section, replace "Only muscles trained in the last 4 weeks or below range are shown" with "Only muscles trained in the last 4 weeks are shown". Also add `ladder?: number[]` and the `decidedOn` field to the spec's API block, so it matches the code.
- [ ] **Step 4: HANDOFF.md.** Add under `## Next`:
  ```
  State Update <date>: Training engine done on `rewrite` (pure domain, no UI): new v2 model, start-empty boot, v2-only backups, exercise library (≥150), phases, step-aware targetsFor with setbacks/stall/time-off/fatigue/test-day, weekly volume. Old engine and golden tests removed.
  Next: revise Plan A for the new model (no migration banner; Settings: Units, Training style, Equipment steps, Download old app data; library browser + Create your own), then Plan B on targetsFor.
  ```
- [ ] **Step 5: Commit**: `git add -A && git commit -m "docs: sync engine spec with implementation and update handoff" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
