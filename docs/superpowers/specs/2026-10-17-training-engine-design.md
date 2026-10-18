# Overload rewrite — Training engine, exercise library and phases

Date: 2026-10-17 · Branch: `rewrite` · Status: approved by owner 2026-10-17
Replaces: the "engine redesign" placeholder (old sub-project 5) and the parity port in `src/domain/progression.ts`. Must be done **before Plan B (Log)**, because the set editor, coaching card and exercise picker are built on it.
Related: `2026-10-09-foundation-design.md` (data layer), `2026-10-09-design-system-and-shell-design.md` (UI), Plan A (`docs/superpowers/plans/2026-10-09-ui-foundation.md`).

## Intent
Dylan's complaint about today's coaching: *"it doesn't consider the exercise I'm doing for weight suggestion, nor the training style I'm going for."* Every lift gets the same +5 lb jump and the same rep range, so a 15 lb lateral raise is told to jump 33% while a squat creeps 2%, and nothing changes between a strength block and a hypertrophy block.

The new engine coaches each lift by **what the exercise actually is** (movement, equipment, muscles, real loadable steps), **the training style of the current phase**, and **how hard each set felt**. It also tracks weekly volume per muscle. It is for Dylan first and must work for any lifter in any gym, because the app is headed to the App Store.

## Goals
1. Weight and rep targets that respect each exercise's loadable step and how big that step is relative to the load.
2. Training styles that run for a period (phases) and change rep ranges, effort targets, set counts, volume targets and rest.
3. Per-set difficulty (reps in reserve) that the engine uses to pace progression.
4. Forgiving handling of bad days, real stalls, whole-body fatigue and time off.
5. A weekly per-muscle volume tracker with plain suggestions.
6. An extensive built-in exercise library (movement × equipment), plus user-defined exercises.
7. An engine API that saved workouts (templates, a later sub-project) can call for "today's targets".

## Non-goals
- Diet, bulking/cutting or body weight. **Dylan explicitly ruled diet out.** Phases are style only.
- A full powerlifting program (peaking, meet prep, percentage blocks). Powerlifting appears only as an occasional per-lift **test day**.
- Saved workouts / programs themselves (separate spec; this one only guarantees the hook).
- Auto-editing a workout. Volume and deload guidance are suggestions the user accepts or ignores.
- Importing the old app's history (see Data).

## Anti-goals (would make this a failure even if it technically works)
Dylan wasn't sure; these are **my call**, consistent with everything he did say:
- Suggesting a weight that can't be loaded on that exercise's equipment.
- Punishing a single bad day (dropping weight after one off session).
- Coaching without saying why: every suggestion carries a one-line reason.
- Changing the user's workout or settings without them.
- Making rating mandatory to get coaching (unrated sets still get coached, just less precisely).

## Decisions made with the owner (2026-10-17)
- **Styles:** strength and hypertrophy (bodybuilding = hypertrophy). Powerlifting = occasional test day on a lift.
- **Phases:** a style held for a stretch of time; Dylan runs strength while gaining and hypertrophy while leaning out, but the app must not know or care about diet.
- **Exercises:** remove the user-facing compound/isolation type from the normal flow; choose from an extensive built-in library organized by movement then equipment (bench: barbell / dumbbell / machine / Smith; incline the same; curls: barbell / EZ bar / dumbbell / cable / machine; and so on). Users can add their own exercise, and for those they **must** pick equipment, muscles worked (required), and compound or isolation.
- **Any gym:** per-exercise weight-step override.
- **Big relative jumps:** stay at the weight longer and build reps (lateral raises at 15 lb), rather than suggesting fractional plates.
- **Difficulty:** rated on **every** set as reps in reserve.
- **Volume:** a weekly tracker per muscle, weeks start **Sunday**, suggestions only.
- **Bad days / stalls / deloads / time off:** the rules in "Coaching rules" below, as proposed and approved.
- **Data:** the new app **starts empty**. Old workouts are not migrated.

## Data model
The rewrite has never shipped and no device holds `overload.v2` data, so the v2 document shape is redefined here rather than migrated (**my call**; `schemaVersion` stays 2). From the first shipped version on, normal "never lose data" rules apply.

**Start empty.** Boot no longer migrates legacy keys: missing `overload.v2` ⇒ fresh empty document. Legacy keys (`exercises`, `sessions`, `customGroups`, `settings`) are still **never modified or deleted**, and Settings → Data & backup keeps a "Download old app data" button that exports them raw (uses the existing `dumpLegacyRaw`). Backup import accepts **v2 only**; v1 files are rejected with "This backup is from the old app and can't be imported" (**my call**, follows from starting empty).

**Exercise library** (static data shipped with the app, `src/domain/library/`):
```ts
type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "smith" | "ez-bar" | "trap-bar"
  | "kettlebell" | "bodyweight" | "band" | "plate";
type Muscle = "chest" | "front-delts" | "side-delts" | "rear-delts" | "lats" | "upper-back" | "traps"
  | "lower-back" | "biceps" | "triceps" | "forearms" | "abs" | "obliques"
  | "quads" | "hamstrings" | "glutes" | "adductors" | "abductors" | "calves";
type LiftClass = "compound" | "isolation";

interface LibraryExercise {
  id: string;              // stable slug, e.g. "bench-press.dumbbell"; never reused
  movement: string;        // "Bench press"
  variant?: string;        // "Incline", "Close-grip", "Single-arm" …
  equipment: Equipment;
  name: string;            // display, "Bench press (dumbbell)"
  aliases: string[];       // search terms, e.g. ["db bench", "flat db press"]
  primary: Muscle[];       // count 1 set each toward weekly volume
  secondary: Muscle[];     // count 0.5 set each
  class: LiftClass;        // hidden from the user for library entries
  loadKind: "external" | "bodyweight" | "assisted"; // assisted = machine subtracts load
}
```
**User exercises** (`doc.exercises`, what the user has actually added to "my exercises"):
```ts
interface Exercise {
  id: string;
  libraryId: string | null;   // null = custom exercise
  name: string;               // copied from the library; user may rename
  equipment: Equipment;
  primary: Muscle[];          // required, ≥1 (custom: user picks; library: copied, editable)
  secondary: Muscle[];
  class: LiftClass;           // custom: user picks; library: copied
  loadKind: "external" | "bodyweight" | "assisted";
  step: number | null;        // per-exercise weight step override in the user's unit; null = equipment default
  archived: boolean;          // hidden from pickers, history kept
}
```
Library fields are **copied on add** so a later library update never rewrites a user's history (**my call**). `muscleGroup` and `customGroups` are removed; pickers and the volume tracker group by muscle (with display regions Chest / Back / Shoulders / Arms / Legs / Core derived from muscles).

**Sets, blocks, sessions:**
```ts
interface SetEntry { weight: number; reps: number; warmup: boolean; rir: 0 | 1 | 2 | 3 | 4 | null } // 4 = "4+"; null = not rated
interface Block { id: string; exerciseId: string; test: boolean; sets: SetEntry[] }               // test = powerlifting test day
interface Session { id: string; date: string /* local YYYY-MM-DD */; name: string; blocks: Block[] }
```
The reserved `rpe` field is replaced by `rir`. For `loadKind: "bodyweight"`, `weight` is **added** load (0 = bodyweight only); for `"assisted"`, `weight` is the assistance (higher = easier).

**Settings:**
```ts
type Style = "strength" | "hypertrophy";
interface Phase { id: string; style: Style; startDate: string }        // current = latest startDate ≤ today
interface StyleRules { compound: ClassRules; isolation: ClassRules; volume: { low: number; high: number } }
interface ClassRules { repLow: number; repHigh: number; sets: number; rirLow: number; rirHigh: number; restSeconds: number; warmupSets: number }
interface Settings {
  unit: "lb" | "kg";
  phases: Phase[];                                    // starts with one hypertrophy phase dated first launch (my call)
  styles: Record<Style, StyleRules>;                  // user-editable copies of the defaults
  equipmentSteps: Record<Equipment, number>;          // per-gym defaults, editable
  theme: "system" | "dark" | "light";
}
```
The global `increment` and the `compound`/`isolation` settings blocks are removed. The rest timer default comes from the current style and lift class.

## Defaults
**Styles** (approved as proposed, diet column dropped):

| | Strength | Hypertrophy |
|---|---|---|
| Compound reps / sets | 3–6 × 3 | 6–10 × 3 |
| Isolation reps / sets | 6–10 × 3 | 10–15 × 3 |
| Target RIR | 1–2 | 0–2 |
| Weekly sets per muscle | 6–12 | 10–20 |
| Rest compound / isolation | 180 s / 120 s | 120 s / 90 s |
| Warm-up sets compound / isolation | 3 / 1 | 2 / 1 |

**Equipment steps** (**my call**, editable per gym and per exercise):

| Equipment | lb | kg |
|---|---|---|
| barbell, smith, ez-bar, trap-bar | 5 | 2.5 |
| dumbbell | 5 | 2 |
| machine | 10 | 5 |
| cable | 5 | 2.5 |
| kettlebell | 9 | 4 |
| plate | 10 | 5 |
| bodyweight / assisted (added or assistance load) | 5 | 2.5 |
| band | n/a (reps only) | n/a |

All suggested weights are rounded to a multiple of the exercise's step; a suggestion is never a weight that isn't a multiple.

## Coaching rules
Engine is pure TypeScript in `src/domain/engine/` with no React or storage imports.

**Inputs:** the exercise, its history (blocks, newest first), the current phase's rules for the exercise's class, settings, and today's date. Test blocks and warm-up sets are excluded from every rule below except records.

All targets are suggestions: the coaching card shows them and the user logs whatever they actually did. Only the whole-body fatigue week (rule 6) needs an explicit accept, because it changes every lift at once.

**Reading a session.** W = the session's top working weight. "Sets at W" are the working sets at exactly W; lighter back-off or pyramid sets are ignored by rules 1–5 but still count toward volume. A *performance* is (weight, best reps at that weight); one performance beats another if its weight is higher, or the weight is equal and reps are higher.

**Two estimates** (**my call**, fixes a conflict found in review):
- *Prediction* (rule 1 only): Epley on effective reps (reps + rir; rir null ⇒ +0; "4+" ⇒ 4), **uncapped**, so high-rep isolation work keeps counting.
- *Display estimate* (charts, records, test day): the same, but only from sets with effective reps ≤ 12; if none qualify, effective reps are capped at 12. It never drives progression decisions.

**1. Earning the next weight.** With next loadable weight W' = W + step:
- Move up when at least `sets` working sets at W reached `repHigh`, **and** the prediction from the best set at W gives at least `repLow` reps at W' (Epley inverted, rounded down).
- If the first test passes but the second doesn't (a big relative jump), **stay at W and extend the rep target** one rep per session beyond `repHigh`, up to a ceiling of `repHigh + 6`. Move up when the prediction passes or when the ceiling is reached, whichever is first (**my call** on the ceiling). Worked example, hypertrophy isolation 10–15: lateral raises at 15 lb need about 24 reps to predict 10 at 20 lb, so the ceiling decides. Targets climb 16, 17 … 21, then the move to 20 lb. Reason shown: "20 lb is a big jump from 15 lb, so build to 21 reps here first." On a 225 lb squat at 6–8 reps, the prediction passes at 8 reps, so the lift moves up as soon as it reaches the top of the range.
- If those sets reached `repHigh` with rir ≥ 3 and the prediction holds at W + 2·step, move up **two** steps (replaces the old "blowout" rule).
- The new weight's rep target resets to `repLow`.

**2. Building reps.** Otherwise, targets for the next session stay at W, per set: bump the lowest set below `repHigh` by one rep (as today). Then adjust by effort when sets are rated:
- Average working-set rir **above** `rirHigh` (too easy) ⇒ +2 on the lowest set instead of +1.
- Average rir **below** `rirLow` with fewer reps than the session before ⇒ hold last session's reps (no bump).
Each set target carries the style's target RIR range for display.

**3. One bad session.** A session is *bad* only when compared with the previous session of the same lift **at the same W and in the same phase**. It is bad if best reps at W fell by 2 or more, or the first working set missed `repLow` (**my call** on thresholds). Sessions at a different W are never compared. That covers intentional drops, deloads, returns from time off and phase starts, so planned light sessions can't cascade into more drops. A hypertrophy half-sets session at the same W isn't bad, because it compares reps, not total work. After one bad session, the targets repeat the previous ones. Reason: "Last session was off, so same weight, try again."

**4. Two bad sessions in a row** on a lift (both by rule 3's definition): drop one step from W and set reps to `repLow`.

**5. Stall.** Within the current phase, the lift has ≥ 4 sessions, none of the last 3 sessions beat the best performance from before them, and average rir over those 3 is ≤ 1 when rated (if unrated, the performance test alone applies). Performances are compared on weight and reps, not the estimate, so high-rep lifts stall correctly. Response:
- strength: the next session is at 90% of W, rounded down to a step, with normal sets. Rules 1–2 rebuild from there.
- hypertrophy: same weight, **half the sets** (rounded up), for sessions of this lift dated within 7 days after the session that completed the stall. That window is derived from history, so it needs no stored state.
Cooldown: after a stall response, rule 5 can't fire again on that lift until 3 more sessions exist after the response session. Reason names the stall ("No progress on bench in 3 sessions").

**6. Whole-body fatigue.** If, within the current Sunday–Saturday week, at least 4 distinct lifts were trained and at least half of them had a bad session, show one app-level suggestion: "Most lifts were down this week — take a lighter week?" Accepting it sets, for the next 7 days, every lift's target to 90% of its W (rounded down to a step) with half the sets. The user can dismiss it. It is never applied automatically.

**7. Time off.** Gap = days since this lift's last non-test session. Gap ≥ 14 ⇒ start at 90% of W; gap ≥ 28 ⇒ 80%; both rounded down to a step, reps at `repLow`. The next two sessions climb back to W in two equal steps (rounded to a step), unless rules 1–4 say otherwise.

**8. Phase change.** Rules use only the new phase's ranges from its start date. The first session of a lift in a new phase keeps W but retargets reps into the new range (strength: `repHigh` of the new range at W if the estimate predicts it, else drop to the heaviest step whose prediction reaches `repLow`; hypertrophy: W, and the estimate decides whether W − step is needed to reach `repLow`).

**9. Test day (powerlifting).** A block with `test: true`: the engine suggests a work-up toward the current estimated 1RM (e.g. 3–4 singles stepping to ~95%; exact ladder is the builder's call) and records the best result as a record. Test blocks never feed rules 1–8.

**10. Bodyweight, assisted and band lifts** have no usable strength estimate (body weight is out of scope), so they use reps and load steps instead (**my call**):
- Progression: build reps to `repHigh`. Then, for `bodyweight`, add one step of load (reset to `repLow`); for `assisted`, remove one step of assistance. Bands: reps only, with a reason suggesting the next band when reps pass `repHigh + 5`.
- Rules 3–5 work unchanged, since they compare reps at the same load.
- "Lighter" always means *easier*. For bodyweight lifts, take off one step of added load (or reps at `repLow` if none is added). For assisted lifts, add one step of assistance. That replaces "90% / 80% of W" in rules 5, 6 and 7 (time off of 28+ days uses two steps). Half-sets responses apply as written.
- Test day isn't offered for these lifts. Charts show reps (and added load) instead of an estimate.

**11. No history.** First time on a lift: no weight suggestion; show the style's rep range and target RIR, and after the first session rule 1–2 take over.

**Precedence:** test day (9) → time off (7) → two bad (4) → stall (5) → one bad (3) → earn weight (1) → build reps (2). App-level fatigue (6) overrides per-lift targets only while accepted.

**Output (the API templates will call):**
```ts
interface LiftTargets {
  exerciseId: string;
  rule: "first-time" | "earn" | "earn-double" | "extend-reps" | "build-reps" | "repeat" | "drop" | "stall-deload"
      | "stall-volume" | "fatigue-week" | "return" | "phase-start" | "test-day";
  weight: number | null;
  sets: { reps: number; rirLow: number; rirHigh: number }[];   // length = style's `sets` (halved when a half-sets rule applies)
  ladder?: number[];                                           // test day only: the singles to work up through
  warmups: { weight: number; reps: number }[];                 // ramp to `weight`, existing algorithm, step-rounded
  reason: string;                                              // one plain sentence
  restSeconds: number;
}
function targetsFor(exerciseId: string, doc: StoreDoc, today: string, opts?: { test?: boolean }): LiftTargets;
function fatigueSuggestion(doc: StoreDoc, today: string): { weekStart: string; reason: string } | null;
```
Per-set targets come from the sets at W last session. A target set with no counterpart (the user did fewer sets than the style asks for) copies the last counterpart's reps. Extra sets the user added beyond the style's count are ignored. The only stored engine state is `doc.coaching.fatigueWeeks: { weekStart: string; status: "accepted" | "dismissed"; decidedOn: string }[]`, written when the user taps Accept or Dismiss on the fatigue suggestion. `targetsFor` reads it from the doc, so it stays pure (**my call**). Test day is an option passed by the caller (the Log screen's per-block toggle, or a template), not inferred.

**Implementation notes (2026-10-17).** Assisted lifts default to the bodyweight step, as in the step table. A layoff of 14+ days resets the stall window, as a phase start does, so the ramp back can't read as a stall.

**Units.** Switching lb ↔ kg converts **all logged weights** (×0.4536 or ×2.2046, rounded to 0.1) after a confirmation that shows how many sets will change. Equipment steps reset to the new unit's defaults, and per-exercise step overrides are cleared, with the confirmation saying so (**my call**). The old app's "relabel only" behavior is dropped because the app now targets other lifters, and a relabel silently corrupts every suggestion. Rounding to a step happens only on new suggestions, never on converted history. **Lossless round trips (2026-10-17):** every converted set keeps `orig: { weight, unit }` (its weight as logged), so switching back restores the exact numbers (225 lb → 102.1 kg → 225 lb), however many times the user switches. Editing a set's weight clears `orig` (Plan B set editor).

## Weekly volume tracker
- Week = Sunday 00:00 to Saturday 23:59, local time.
- Counts working, non-warm-up sets (test sets included) from the week's sessions: +1 per primary muscle, +0.5 per secondary.
- Shows each muscle against the current style's `volume.low–high`, sorted with the biggest shortfall first.
- Suggestion text: under ⇒ "Side delts: 6 of 10–20 this week — add 4"; over ⇒ "Quads: 24, above 20 — consider fewer next week". Only muscles trained in the last 4 weeks are shown (**my call**, so unused muscles don't nag).
- Lives in the Stats tab as a "Volume" view next to Charts and Records (**my call**; UI detail in Plan C).

## Exercise library content
Minimum coverage. Each row is one movement; each listed equipment is one entry. Target ≥ 150 entries; naming "Movement (equipment)" with variants in the movement name ("Incline bench press (dumbbell)").
- **Chest:** bench press (barbell, dumbbell, machine, smith); incline bench press (same four); decline bench press (barbell, dumbbell, machine); chest fly (dumbbell, cable, machine/pec deck); cable crossover (high-to-low, low-to-high); dip (bodyweight, assisted, weighted); push-up (bodyweight, weighted).
- **Back:** deadlift (barbell, trap-bar); sumo deadlift; Romanian deadlift (barbell, dumbbell); row (barbell, Pendlay, single-arm dumbbell, chest-supported dumbbell, T-bar, seated cable, machine); pull-up and chin-up (bodyweight, assisted, weighted); lat pulldown (wide, close/neutral, single-arm cable, machine); straight-arm pulldown (cable); pullover (dumbbell, cable); shrug (barbell, dumbbell, machine, trap-bar); back extension (bodyweight, weighted); rack pull.
- **Shoulders:** overhead press (barbell standing, seated dumbbell, machine, smith); Arnold press; lateral raise (dumbbell, cable, machine); rear-delt fly (dumbbell, reverse pec deck, cable); face pull (cable); front raise (dumbbell, cable, plate); upright row (barbell, ez-bar, cable).
- **Biceps:** curl (barbell, ez-bar, dumbbell, cable, machine); hammer curl (dumbbell, cable rope); preacher curl (ez-bar, dumbbell, machine); incline dumbbell curl; concentration curl; spider curl; Bayesian cable curl; reverse curl (ez-bar, barbell).
- **Triceps:** pushdown (cable bar, rope, single-arm); overhead extension (cable, dumbbell, ez-bar); skull crusher (ez-bar, barbell, dumbbell); close-grip bench press (barbell, smith); dip machine; kickback (dumbbell, cable); JM press.
- **Forearms:** wrist curl and reverse wrist curl (barbell, dumbbell); farmer's carry.
- **Legs:** squat (back barbell, front barbell, smith, safety bar, belt squat); hack squat; pendulum squat; goblet squat (dumbbell, kettlebell); leg press; Bulgarian split squat (dumbbell, barbell, smith); walking lunge (dumbbell); step-up; leg extension; leg curl (lying, seated, standing); hip thrust (barbell, machine, smith); glute bridge; good morning; Nordic curl; adductor machine; abductor machine; calf raise (standing machine, seated, leg press, smith, single-leg dumbbell).
- **Core:** crunch (cable, machine); hanging leg raise; ab wheel; plank; Pallof press (cable); decline sit-up; side bend (dumbbell).

Muscle assignments follow common training references; the builder assigns them, and each entry gets a test that it has ≥ 1 primary muscle and a valid class.

**Adding an exercise:** search the library by name or alias, then pick equipment if the movement has several. "Can't find it? Create your own" opens a form: name (required), equipment (required), primary muscles (required, ≥ 1), secondary muscles (optional), compound or isolation (required), step override (optional).

## Impact on the other plans
- **Foundation code:** `migrate.ts`, `legacyToDoc` and the v1 import path are retired from boot and import (kept only for "Download old app data"). `normalize.ts`/`validateDoc` move to the new shape. The old engine's golden tests are deleted along with `progression.ts` (the reference copy in `tests/reference/` is no longer needed). Types change as listed above.
- **Plan A:** drop the migration banner and its tests; boot becomes "load or start empty"; Settings replaces the Units/Increment and Compound/Isolation rules cards with **Units**, **Training style** (current style, phase start, editable style rules), **Equipment steps**, and adds "Download old app data"; the Exercise library view becomes the library browser + "Create your own" form described above (no muscle-group management, no type badge). Plan A must be revised after this spec is approved.
- **Plan B (Log):** set editor gets a per-set RIR tap row (0 / 1 / 2 / 3 / 4+), a coaching card per lift showing `LiftTargets` (weight, per-set reps, target RIR, reason), a test-day toggle per block, and the fatigue-week suggestion.
- **Plan C:** Stats gains the Volume view; charts mark phase starts.

## Testing
- Engine rules: one table-driven test file per rule (1–11) plus precedence tests, using small hand-built histories.
- A scenario test per style over ~8 simulated sessions (steady progress, a big-jump isolation lift, a stall, a layoff, a phase change).
- Rounding: no suggested weight is ever off-step, for every equipment and both units (property-style test over random inputs).
- Library integrity: unique ids, every entry has ≥ 1 primary muscle, valid class, valid equipment, name follows the convention.
- Volume: Sunday week boundaries in local time, primary/secondary weighting, warm-ups excluded.

## Left to the builder
File layout inside `src/domain/engine/` and `src/domain/library/`; exact muscle assignments per library entry; the test-day work-up ladder; wording of reasons beyond the examples; the Epley inversion helper; performance (histories are small).
