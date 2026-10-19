# Plan C — Progress, History, muscle map, cutover: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the Progress and History tabs (muscle map, headline, lift list, lift chart, calendar, workout screen, Repeat this workout), give the app a premium Midnight/teal icon, and make the new app the live app at `/`.

**Architecture:** Pure domain functions in `src/domain/` compute every number (tested without React); `src/features/progress/` and `src/features/history/` render them with the existing primitives (`ListGroup`/`ListRow`, `Segmented`, `SheetStack`, `Toast`). Pushed screens (lift chart, workout) open as sheets with a `SheetStack`, like Settings and Next exercise. The Repeat queue lives in UI state (`overload.v2.ui`, v4). Charts and the figure are hand-rolled inline SVG — no new dependency.

**Tech Stack:** React 19, TypeScript, Vite 6, zustand 5, motion 13.5.1, vitest + Testing Library, vite-plugin-pwa, @vite-pwa/assets-generator.

**Spec:** `docs/superpowers/specs/2026-10-19-progress-history-cutover-design.md` (approved 2026-10-19). Read it with this plan.

## Global Constraints

- Branch `rewrite`. **Never push or merge to `main` without Dylan's explicit yes** — it deploys production.
- Definition of done per task: `npm test`, `npm run typecheck`, `npm run lint` green; `npm run build` before each wave's end. Show the output.
- Waves (Dylan's rule): finish a wave, show results, wait for his go before the next. Wave 1 = Tasks 1–3, Wave 2 = 4–6, Wave 3 = 7–9, Wave 4 = 10–11.
- Never lose data: no change to `StoreDoc`/backup shape. UI state goes v3 → **v4**; a v3 draft must survive.
- Window for Progress: **last 8 weeks** (56 days ending on today). A lift **counts** with **≥ 3 sessions** with working sets in the window. **Test-day sets count** in Progress.
- Strength thresholds: **Flat** = change within ±2%; **Up** = > +2% and < +5%; **Up a lot** = ≥ +5%; **Down** = < −2%.
- This-week states: **None** (0 sets) · **Under half** (< 50% of low) · **Almost** (≥ 50% of low, < low) · **In range** (low..high) · **Over** (> high).
- Copy, verbatim: "Stronger on {n} of {m} lifts", "Average est. 1RM {+6%}", "Not enough data yet", "Log a few sessions to see progress here", "{Muscle} · {sets} of {low}–{high} sets this week · add {n}", "{sets}, above {high} — consider fewer next week", "Repeat this workout", "Skipped {n} archived exercise(s)", "Up next".
- Apple-design (spec checklist): press feedback on pointer-down; pushed views enter from the right and swipe back; critically damped springs (`SPRING` from `src/ui/motion.ts`), bounce only after a flick; tabular numerals; rem sizes; reduced motion → cross-fades; color never the only signal.
- No new runtime dependency. CSS Modules use type tokens (existing token test enforces it); no text under 13px.
- Commit messages: semantic (`feat(progress): …`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Gaps and sparse data** — a lift with sessions only at the window edges, a muscle whose only lift is archived, a brand-new account: no NaN/Infinity, no empty charts; states fall back to "No data" / "Not enough data yet". (Tests in Tasks 1, 2.)
2. **Unit switch** — weights shown and changes computed in the current unit after `convertUnits`; "+15 lb" becomes "+7 kg"-ish, never mixed. (Test in Task 1.)
3. **Editing a past set** from History updates Progress and the weekly map immediately, and Undo restores the exact set (including `orig`). (Test in Task 8.)
4. **Repeat while mid-entry** — typed but unlogged weight/reps on the Log are never overwritten; queued exercises already logged today are left out; queue from yesterday is gone today. (Tests in Tasks 3, 9.)
5. **Service-worker takeover** — a phone that has the old app cached gets the new app without being stuck, and nothing logged in `overload.v2` is lost across rollback/roll-forward. (Manual check in Task 11.)

---

## Wave 1 — domain

### Task 1: Progress numbers

**Files:**
- Create: `src/domain/progress.ts`
- Test: `tests/domain/progress.test.ts`

**Interfaces:**
- Consumes: `displayE1rm`, `effectiveReps` (`src/domain/strength.ts`); `addDays` (`src/domain/dates.ts`); `phaseOf` (`src/domain/settings.ts`); builders `ex/day/doc/sets` (`tests/helpers/build.ts`).
- Produces:
  ```ts
  export const WINDOW_DAYS = 56;
  export const MIN_SESSIONS = 3;
  export type Metric = "e1rm" | "reps";
  export type Trend = "down" | "flat" | "up" | "up-a-lot";
  export interface SeriesPoint { date: string; value: number; test: boolean; phaseStart: boolean }
  export interface LiftProgress {
    exerciseId: string; name: string; metric: Metric;
    sessions: number;                 // in window
    points: SeriesPoint[];            // in window, oldest first
    change: number | null;            // in unit (e1rm) or reps; null when sessions < MIN_SESSIONS
    pct: number | null;
    trend: Trend | null;
  }
  export interface Attention { exerciseId: string; name: string; reason: string }
  export interface ProgressSummary { stronger: number; counted: number; avgPct: number | null; lifts: LiftProgress[]; attention: Attention[] }
  /** Est. 1RM for one session: Moderate/Hard/All-out sets add reps-left (cap 12 effective reps); Easy and unrated add nothing. */
  export function sessionE1rm(sets: SetEntry[]): number;
  export function metricOf(ex: Exercise, sets: SetEntry[]): Metric;
  export function liftSeries(doc: StoreDoc, exerciseId: string, from: string, to: string): SeriesPoint[];
  export function trendOf(pct: number): Trend;
  export function progressSummary(doc: StoreDoc, today: string): ProgressSummary;
  ```

- [ ] **Step 1: Write the failing tests** in `tests/domain/progress.test.ts`:
  - `liftSeries` returns one point per date with working sets (warm-ups ignored), oldest first; a test block's sets are included and that point has `test: true`; `phaseStart` is true on the first point on/after a phase's `startDate`.
  - `progressSummary` on a doc with: bench 4 sessions in window rising (135×8 → 145×8), curl 2 sessions, squat 3 sessions falling, an archived lift with 4 sessions → `counted === 2`, `stronger === 1`, `lifts.map(l => l.exerciseId)` excludes the archived one, curl has `change === null` and `trend === null`.
  - Ordering: most sessions first, ties by name.
  - Start/end: `change = max(value of last two points) − max(value of first two points)`; with points [200, 180, 190, 210] → change `10`, `pct` `5` → trend `"up-a-lot"`.
  - `trendOf`: `-2.01 → "down"`, `-2 → "flat"`, `2 → "flat"`, `2.01 → "up"`, `4.99 → "up"`, `5 → "up-a-lot"`.
  - `metricOf`: band equipment → `"reps"`; `loadKind: "assisted"` → `"reps"`; bodyweight with every window set `weight === 0` → `"reps"`; weighted bodyweight or external → `"e1rm"`. A reps metric's point value is the best `effectiveReps` of the session.
  - Sessions dated after `today` and before the window are ignored.
  - Unit switch (Review Focus 2): build a lb doc, run `convertUnits(doc, "kg")`, `progressSummary` change is in kg (≈ bench change × 0.4536, rounded to whole units).
  - Empty doc → `{ stronger: 0, counted: 0, avgPct: null, lifts: [], attention: [] }`; no NaN anywhere (Review Focus 1).
  - `sessionE1rm`: 185×8 All out → 234; Hard → 241 (185 × 1.3 rounds up); Moderate → 247; **Easy → 234** (not 259); unrated → 234; a 185×8 Easy set next to a 185×6 Hard set → max(234, 185×(1+7/30)=228) = 234; 100×11 Moderate → capped at 12 effective → 140.
  - `attention`: only counted Flat/Down lifts, at most 3, ordered Down before Flat then by pct ascending; reason precedence exactly as in the spec (Easy-heavy → All-out-and-down → muscle under range → mostly unrated → default), copy verbatim from the spec; empty when every counted lift is Up.
- [ ] **Step 2: Run** `npx vitest run tests/domain/progress.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/domain/progress.ts`. e1rm points use `sessionE1rm(sets)` (not `displayE1rm`, which trusts Easy ratings) of that day's working sets (all blocks of the exercise, test included). `pct = change / startValue * 100`, rounded to 1 decimal; `avgPct` = mean pct of counted lifts rounded to integer, `null` when none counted. `change` rounded to whole units. Lifts listed = non-archived exercises with ≥ 1 session in window.
- [ ] **Step 4: Run** the test — Expected: PASS. Then `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** `feat(progress): 8-week lift series, trends and headline numbers`.

### Task 2: Muscle-map states

**Files:**
- Create: `src/domain/muscleMap.ts`
- Test: `tests/domain/muscleMap.test.ts`

**Interfaces:**
- Consumes: `weeklyVolume`, `VolumeRow` (`src/domain/volume.ts`); `progressSummary`, `Trend`, `LiftProgress` (Task 1); `MUSCLES` (`src/domain/types.ts`).
- Produces:
  ```ts
  export type WeekState = "none" | "under-half" | "almost" | "in" | "over";
  export interface WeekCell { state: WeekState; sets: number; low: number; high: number }
  export interface StrengthCell { state: Trend | "no-data"; lifts: LiftProgress[] } // counted lifts whose primary includes the muscle
  export function weekMap(doc: StoreDoc, today: string): Record<Muscle, WeekCell>;
  export function strengthMap(doc: StoreDoc, today: string): Record<Muscle, StrengthCell>;
  export function weekLine(muscle: Muscle, cell: WeekCell): string; // the panel copy from Global Constraints
  ```

- [ ] **Step 1: Write the failing tests:** every muscle in `MUSCLES` has a cell; with hypertrophy (10–20) — 0 sets → `none`, 4 → `under-half`, 5 → `almost`, 9.5 → `almost`, 10 → `in`, 20 → `in`, 21 → `over`; a muscle not trained in 4 weeks → `none` with `sets: 0`. Strength: chest with bench +6% and fly +1% (both counted) → mean 3.5 → `"up"`; a muscle whose only lift has 2 sessions → `"no-data"`; secondary-only muscles don't get the lift. `weekLine("side-delts", {state:"under-half", sets:2, low:10, high:20})` → `"Side delts · 2 of 10–20 sets this week · add 8"`; over → `"Quads · 24, above 20 — consider fewer next week"`.
- [ ] **Step 2: Run** `npx vitest run tests/domain/muscleMap.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `src/domain/muscleMap.ts` (reuse `weeklyVolume` rows; muscles absent from its rows get `sets: 0` and the style range).
- [ ] **Step 4: Run** — Expected: PASS; then the full gate.
- [ ] **Step 5: Commit** `feat(progress): muscle-map week and strength states`.

### Task 3: History days and the Repeat queue

**Files:**
- Create: `src/domain/historyDays.ts`
- Modify: `src/state/uiStore.ts` (v4: `LogUi.queue`; actions)
- Test: `tests/domain/historyDays.test.ts`, `tests/state/uiStore.test.ts` (add cases)

**Interfaces:**
- Consumes: `MUSCLE_LABEL` (`src/domain/library/muscles.ts`); `sessionOn` (`src/domain/log.ts`).
- Produces:
  ```ts
  // historyDays.ts
  export function trainingDays(doc: StoreDoc): Set<string>;            // dates with ≥ 1 working or warm-up set
  export function latestTrainingDay(doc: StoreDoc, today: string): string | null;
  export interface DaySummary { date: string; muscles: string[]; exerciseCount: number } // muscles: top 3 labels by primary working sets
  export function daySummary(doc: StoreDoc, date: string): DaySummary | null;
  export function repeatQueue(doc: StoreDoc, fromDate: string, logDay: string): { ids: string[]; skipped: number };
  // uiStore.ts
  export interface LogUi { draft; startedAt; last; queue: { day: string; ids: string[] } | null }
  setQueue(day: string, ids: string[]): void;
  /** Drops an exercise from the queue (after it's picked). */
  unqueue(exerciseId: string): void;
  ```
- [ ] **Step 1: Write the failing tests:**
  - `daySummary` on a push day → `muscles` `["Chest", "Triceps", "Side delts"]` ordered by primary working sets; `exerciseCount` 6; date with no session → `null`.
  - `repeatQueue`: keeps block order; skips archived exercises (`skipped` counts them); leaves out exercises already logged on `logDay`; duplicate blocks of one exercise appear once.
  - uiStore: `setQueue` then persist → stored JSON has `version: 4` and the queue; hydrate from a stored **v3** blob with a draft → draft unchanged, `queue === null`; a queue whose `day` ≠ the draft's day is dropped on read; malformed `queue` → `null`; `unqueue` removes one id, and an empty queue becomes `null`.
- [ ] **Step 2: Run** `npx vitest run tests/domain/historyDays.test.ts tests/state/uiStore.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** both. In `uiStore.ts`: write `version: 4`; accept `saved.version` 1–4; `readLog` reads `queue` only when `version >= 4`; `EMPTY_LOG.queue = null`.
- [ ] **Step 4: Run** — Expected: PASS; then the full gate.
- [ ] **Step 5: Commit** `feat(history): day summaries, repeat queue and UI state v4`.

**End of Wave 1:** run `npm run build`, show gate output, wait for Dylan.

---

## Wave 2 — Progress tab

### Task 4: Geometric muscle figure

**Files:**
- Create: `src/features/progress/MuscleFigure.tsx`, `src/features/progress/figurePaths.ts`, `src/features/progress/Progress.module.css`
- Modify: `src/styles/tokens.css` (map tones), `tests/styles/tokens.test.ts`
- Test: `tests/features/muscleFigure.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // figurePaths.ts — left-half polygons, mirrored at render; base plates (head, hands, knees, feet) separate
  export const FRONT: { muscle: Muscle | null; points: string }[];
  export const BACK: { muscle: Muscle | null; points: string }[];
  // MuscleFigure.tsx
  export type Tone = "none" | "l1" | "l2" | "l3" | "over" | "down" | "flat";
  export function MuscleFigure(props: {
    tones: Record<Muscle, Tone>;
    labels: Record<Muscle, string>;   // VoiceOver: "Side delts, 2 of 10 to 20 sets"
    selected: Muscle | null;
    onSelect(m: Muscle): void;
  }): JSX.Element;
  ```
  Tokens (both themes, plus the light media block): `--map-none`, `--map-l1`, `--map-l2`, `--map-l3`, `--map-over`, `--map-down`, `--map-flat`, `--map-base`.
- [ ] **Step 1: Write the failing tests:** every muscle in `MUSCLES` renders at least one `button`-role element named by its label; tapping one calls `onSelect` with it; `selected` adds `aria-pressed="true"`; small muscles (`rear-delts`, `side-delts`, `forearms`, `calves`) have a hit area (transparent `stroke-width` ≥ 8 on an invisible copy). Token test: `l1, l2, l3, over, down, flat` each ≥ **3:1** against `surface` in dark and light; `none`/`base` exempt.
- [ ] **Step 2: Run** `npx vitest run tests/features/muscleFigure.test.tsx tests/styles/tokens.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Draw the figure in a 120×240 viewBox per side (front, back), believable proportions (legs ≈ half the height, knees joined), flat plates with a 1.5px gap (stroke in `--surface`), no gradients. Pecs as two plates, ab grid, quad teardrop + inner plate, lats as wings, glutes, hamstrings, calves. Each plate is an SVG `<g role="button" tabindex="0">` with `aria-label`; Enter/Space selects. Selected plate gets a `--text` outline. Fills `var(--map-<tone>)`; fill changes cross-fade (`transition: fill var(--dur-fast)`). Before committing, open `/next.html` with a dev harness (or the Progress tab once Task 5 lands) and screenshot at 390px in both themes; check every muscle is recognisable and the figure reads as a body.
- [ ] **Step 4: Run** — Expected: PASS; full gate.
- [ ] **Step 5: Commit** `feat(progress): geometric front/back muscle figure with map tones`.

### Task 5: Progress screen

**Files:**
- Create: `src/features/progress/ProgressScreen.tsx`, `src/features/progress/Sparkline.tsx`
- Modify: `src/app/Shell.tsx` (`PANELS.progress = ProgressScreen`), `src/features/placeholders.tsx` (remove `ProgressPlaceholder`)
- Test: `tests/features/progress.test.tsx`

**Interfaces:**
- Consumes: `weekMap`, `strengthMap`, `weekLine` (Task 2); `progressSummary` (Task 1); `MuscleFigure` (Task 4); `Segmented`, `ListGroup`, `ListRow`, `EmptyState`; `useApp`, `useUi`.
- Produces: `ProgressScreen()`; `Sparkline({ points: SeriesPoint[]; trend: Trend | null })`. Opening a lift calls `openSheet("lift", { arg: exerciseId })` (Task 6 adds the sheet; until then the call is typed but the sheet renders nothing).
- Layout top → bottom: `Segmented` "This week · Strength" → figure → tap panel → headline group → "Needs attention" group (only when `attention` is non-empty; each row: lift name + reason, taps open the lift chart) → "Your lifts" group.
- Tone mapping — week: none→none, under-half→l1, almost→l2, in→l3, over→over; strength: no-data→none, down→down, flat→flat, up→l2, up-a-lot→l3. Legend always shows word + swatch.
- [ ] **Step 1: Write the failing tests:** empty doc → "Log a few sessions to see progress here" and the figure still renders (week view); seeded doc → headline "Stronger on 1 of 2 lifts" and "Average est. 1RM +6%"; lift rows in order with "+15 lb" / "Not enough data yet"; switching to Strength changes the legend words; tapping the side-delts plate shows `weekLine` text in the panel; in Strength, tapping chest lists its lifts; tapping a lift row calls `openSheet("lift", { arg: "bench" })`.
- [ ] **Step 2: Run** `npx vitest run tests/features/progress.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** `uiStore.openSheet` gains `opts.arg?: string` stored as `sheetArg: string | null`; `SheetId` adds `"lift" | "workout"`. Sparkline: 64×20 SVG polyline, color by trend (`--accent`/`--muted`/`--warn`), `aria-hidden`; the row's text carries the meaning.
- [ ] **Step 4: Run** — Expected: PASS; full gate.
- [ ] **Step 5: Commit** `feat(progress): Progress tab with muscle map, headline and lift list`.

### Task 6: Lift chart sheet

**Files:**
- Create: `src/features/progress/LiftChart.tsx`, `src/features/progress/LiftSheet.tsx`
- Modify: `src/app/Shell.tsx` (render `LiftSheet` when `sheet === "lift"`)
- Test: `tests/features/liftChart.test.tsx`

**Interfaces:**
- Consumes: `liftSeries`, `metricOf` (Task 1); `SheetStack`; `Segmented`.
- Produces: `LiftSheet({ exerciseId: string; onClose(): void })`; `LiftChart({ points: SeriesPoint[]; unit: string; metric: Metric })`.
- Ranges: `4 wk` = 28 days, `3 mo` = 91, `1 yr` = 365, default `3 mo`.
- [ ] **Step 1: Write the failing tests:** opens with the exercise name as title; range switch changes the number of plotted points; phase start renders a vertical marker with `aria-label="New phase"`; test-day point has `aria-label` containing "Test day"; "Best set" shows the heaviest e1RM set (`205 × 6`) and "Last time" the latest session's top set; keyboard ←/→ on the chart moves the readout (scrub equivalent); a lift with 0 points in range shows "Not enough data yet".
- [ ] **Step 2: Run** `npx vitest run tests/features/liftChart.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** SVG line chart sized to container width (ResizeObserver), y axis min/max with 5% padding, three gridlines, tabular labels. Scrubbing: pointer down/move with `setPointerCapture`, readout tracks the nearest point 1:1; reduced motion unaffected (no animation). Reps metric labels "reps"; e1rm labels the unit.
- [ ] **Step 4: Run** — Expected: PASS; full gate; browser check at 390px.
- [ ] **Step 5: Commit** `feat(progress): lift chart sheet with ranges, phase marks and scrubbing`.

**End of Wave 2:** `npm run build`, browser walk of Progress at 320×640 and 390×844 (light, dark), show results, wait for Dylan.

---

## Wave 3 — History and Repeat

### Task 7: History calendar

**Files:**
- Create: `src/features/history/HistoryScreen.tsx`, `src/features/history/Calendar.tsx`, `src/features/history/History.module.css`
- Modify: `src/app/Shell.tsx` (`PANELS.history`), `src/features/placeholders.tsx` (delete the file once both placeholders are gone)
- Test: `tests/features/history.test.tsx`

**Interfaces:**
- Consumes: `trainingDays`, `latestTrainingDay`, `daySummary` (Task 3); `weekStart`, `addDays` (`src/domain/dates.ts`).
- Produces: `HistoryScreen()`; `Calendar({ month: string /* YYYY-MM */; days: Set<string>; today: string; selected: string | null; onSelect(d: string): void; onMonth(delta: 1 | -1): void })`. Tapping the summary row calls `openSheet("workout", { arg: date })`.
- [ ] **Step 1: Write the failing tests:** opens on today's month with the latest training day selected and its summary ("Chest, Triceps, Side delts · 6 exercises"); Su–Sa headers; training days have a dot element and `aria-label` "Thursday, October 16, workout"; non-training days are not buttons; ‹ › change month; empty doc → "No workouts logged yet".
- [ ] **Step 2: Run** `npx vitest run tests/features/history.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** Grid of 7 columns; today outlined, training days tinted (`--accent-soft`) + dot, selected solid `--accent`/`--on-accent`. Horizontal swipe on the grid via `useAxisDrag` (x axis) with `commitOnRelease`/`FLICK` from `src/ui/gesture.ts`: the month slides with the finger and springs to the next/prev month or back; reduced motion → cross-fade.
- [ ] **Step 4: Run** — Expected: PASS; full gate.
- [ ] **Step 5: Commit** `feat(history): month calendar with day summaries`.

### Task 8: Workout sheet — view, fix, remove

**Files:**
- Create: `src/features/history/WorkoutSheet.tsx`, `src/features/history/FixSetView.tsx`
- Modify: `src/features/log/SetList.tsx` (prop `label?: string`, default "Sets today"), `src/app/Shell.tsx`
- Test: `tests/features/workoutSheet.test.tsx`

**Interfaces:**
- Consumes: `sessionOn` (`src/domain/log.ts`); `SetList`, `setLabels`; app actions `editSet(ref, set)`, `removeSet(ref)`, `restoreSet(removed)`; `showToast`; `NumberField`, `Segmented` (difficulty), `DIFFICULTIES`, `rirFor`, `difficultyOf`.
- Produces: `WorkoutSheet({ date: string; onClose(): void })`; root view lists blocks "Bench press — 185 × 8, 185 × 7" (working sets); tapping a block pushes its detail view with `SetList label="Sets"`; tapping a set pushes `FixSetView` (weight, reps, difficulty, warm-up; Save/Cancel). "Repeat this workout" button at the root's bottom calls `onRepeat(date)` (Task 9 wires it).
- [ ] **Step 1: Write the failing tests:** working-set summary per block; detail shows warm-ups and difficulty; fixing 185×8 → 190×8 calls `editSet` and the root summary updates; swipe-remove shows an Undo toast and Undo restores the identical set (including `orig`) (Review Focus 3); after an edit, `progressSummary`/`weekMap` from the store reflect it (render Progress after closing the sheet and assert the new number).
- [ ] **Step 2: Run** `npx vitest run tests/features/workoutSheet.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** `SetRef` = `{ day: date, blockId, index }`. Removing the last set of a session follows the existing `removeSet` behavior; when the session disappears, the sheet pops to root and closes if no blocks remain.
- [ ] **Step 4: Run** — Expected: PASS; full gate.
- [ ] **Step 5: Commit** `feat(history): workout sheet with fix and remove`.

### Task 9: Repeat this workout

**Files:**
- Modify: `src/features/history/WorkoutSheet.tsx` (wire button), `src/features/log/NextExerciseView.tsx` ("Up next" group, `unqueue` on pick)
- Test: `tests/features/repeat.test.tsx`

**Interfaces:**
- Consumes: `repeatQueue` (Task 3); `setQueue`, `unqueue`, `setDraft`, `setTab`, `showToast` (uiStore); `freshDraft`, `useLogDay` (`src/features/log/draft.ts`).
- Behavior: on Repeat → `{ ids, skipped } = repeatQueue(doc, date, logDay)`; if `ids` empty, toast "Nothing to repeat" and stay. Else: if the draft has no exercise, or its weight/reps are both untouched (`null`), set the draft to `freshDraft(doc, logDay, ids[0])` and queue `ids.slice(1)`; otherwise queue all `ids` and leave the draft alone. Close the sheet, switch to the Log tab; toast "Skipped {n} archived exercise(s)" when `skipped > 0`.
- [ ] **Step 1: Write the failing tests:** Repeat a 6-exercise day → Log shows exercise 1 with this week's target; Next exercise sheet's first group is "Up next" listing exercises 2–6 in order; picking #2 removes it from "Up next"; picking a non-queued exercise leaves the queue alone; with typed weight on the entry row, Repeat keeps the typed value and queues all six (Review Focus 4); an archived exercise in the source day → toast "Skipped 1 archived exercise"; next day the queue is gone.
- [ ] **Step 2: Run** `npx vitest run tests/features/repeat.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS; full gate.
- [ ] **Step 5: Commit** `feat(history): repeat a past workout into today's Log`.

**End of Wave 3:** `npm run build`, browser walk of History + Repeat at 320/390, light/dark, reduced motion; show results, wait for Dylan.

---

## Wave 4 — icon and cutover

### Task 10: Premium icon

**Files:**
- Create: `public/icon.svg` (replace), regenerated `public/*.png`, `public/favicon.ico`
- Modify: `pwa-assets.config.js` (backgrounds `#0e1118`)

- [ ] **Step 1: Concepts.** Make 3 icon concepts as SVG (1024 master): one simple confident mark, no text or hairlines, subtle gradient/lighting depth, Midnight `#0e1118` field with teal `#3fd0c9` mark. Show them in the brainstorm companion on a home-screen-style grid at 60/120/180 px over a light and a dark wallpaper, plus the maskable crop.
- [ ] **Step 2: Checkpoint — Dylan picks a concept.** Do not continue without his choice; iterate if he asks.
- [ ] **Step 3: Generate.** Save the pick as `public/icon.svg`; run `npx pwa-assets-generator`; confirm the files listed in the manifest exist and the maskable mark sits inside the 80% safe zone (screenshot).
- [ ] **Step 4: Gate** — full gate + `npm run build`.
- [ ] **Step 5: Commit** `feat(brand): premium Midnight/teal app icon`.

### Task 11: Cutover

**Files:**
- Modify: `index.html` (becomes the new app's entry: content of `next.html` minus `noindex`, plus icon/manifest links), `vite.config.js` (single `main` input; drop `dev`/`next` and the `navigateFallbackDenylist`; manifest `theme_color`/`background_color` `#0e1118`, description "Log every set and get told exactly when to add weight." — **builder may tweak wording; show Dylan**), `src/next/main.tsx` → `src/main.tsx` (and register the service worker: `import { registerSW } from "virtual:pwa-register"; registerSW({ immediate: true })`), `README.md`, `HANDOFF.md`
- Delete: `next.html`, `dev.html`, `src/dev/`, `src/App.jsx`, `src/main.jsx`, `src/storage.js`, `src/index.css`, and any file only they import; dependencies only they use (`recharts`, `@fontsource/oswald`, `@fontsource/work-sans`, and `lucide-react` if unused after the deletion — check with grep).
- Keep: `src/data/legacy.ts` and Settings' "Download old app data".

- [ ] **Step 1: Write the failing test** `tests/app/entry.test.ts`: `index.html` references `/src/main.tsx`; contains `theme-color` `#0e1118`; no file under `src/` imports `App.jsx`/`storage.js`; `vite.config.js` has no `next.html`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the moves/deletions above; `npm install` after removing deps.
- [ ] **Step 4: Run** the full gate and `npm run build` — Expected: all green.
- [ ] **Step 5: Service-worker check (Review Focus 5).** Build the current `main` (old app) into a temp dir, serve it, load it in Playwright so its SW installs; then serve the new build on the same origin/port and reload twice: the new app must show without clearing site data, and old keys must still be present in localStorage. Write down the observed behavior for Dylan ("first open may show the old app; the next open shows the new one").
- [ ] **Step 6: Final browser walk** at 320×640 and 390×844, light/dark, reduced motion: Log, Progress (both map views, lift chart), History (calendar, workout, fix/remove, Repeat), Settings → Download old app data.
- [ ] **Step 7: Fresh review** of the Plan C diff (`git diff <wave-1 base>..HEAD`); fix Critical/Important with tests.
- [ ] **Step 8: Commit** `feat: cut over — the new app is the app` and update `HANDOFF.md` (State Update) and `README.md`.
- [ ] **Step 9: Ask Dylan** for the merge. Only on his explicit yes: merge `rewrite` → `main`, push, watch the Netlify deploy, then tell him: open the app twice on the phone; to get the new icon, remove and re-add it to the home screen (data is kept). Rollback = Netlify "Publish deploy" on the previous build.
