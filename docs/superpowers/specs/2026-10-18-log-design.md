# Overload rewrite: Plan B — the Log tab

Date: 2026-10-18 · Branch: `rewrite` · Status: ready for Dylan's review (builder check done)
Builds on: the training engine (`2026-10-17-training-engine-design.md`, done), Plan A UI foundation (`docs/superpowers/plans/2026-10-09-ui-foundation.md`, done: shell, Settings, Exercise library, motion), and the design-system spec (`2026-10-09-design-system-and-shell-design.md`, including its 2026-10-17b revision).
Mockup: `.superpowers/brainstorm/6436-1792330336/content/log-layout-v2.html` (git-ignored; layout B with Next exercise docked at the bottom).

## Intent

The Log tab is where Dylan spends the whole workout. Today it's a placeholder card. Plan B makes it the screen he uses after every set.

How he trains (his words, condensed): he logs after **every set**. Before an exercise he warms up — usually using the suggested warm-up weights, sometimes his own way — and logs the warm-ups he actually did. He follows a split (push / pull / arms) but **no fixed list of exercises**: after finishing one, he decides the next by asking what the day still needs ("I did pull-ups, so I need a horizontal pull"). When he logs a set he looks at **the target for that set and what he did last time**.

What he said is wrong today: nothing about logging feels wrong, except that **switching to Spotify (or anything) sometimes wipes what he typed**. iOS unloads backgrounded web apps; uncommitted input is lost.

Success: logging a set is at least as quick as the old app, nothing typed is ever lost, and the engine's coaching (targets, reasons, difficulty) is right there without slowing him down.

## Goals

1. Log a workout set by set, one exercise at a time, with the engine's target and last time side by side.
2. Rate each working set with a plain **difficulty** word instead of RIR/RPE numbers.
3. Pick the next exercise from his library, seeing which muscles are **still short of their weekly volume**.
4. Never lose input: everything typed survives app switching, page unloads and reloads.
5. Surface the engine features that need the Log: the reason sentence, the per-exercise test-day option, and the whole-body fatigue suggestion.

## Non-goals

- **Exercise suggestions** or "push/pull day" labels. The app shows what's short; Dylan picks.
- **Rest timer.** It doesn't work as a web app (no alerts while backgrounded). It returns with the native wrap (local notifications). A passive "last set 2:14 ago" counter replaces it for now.
- **Backdating or editing other days.** The Log is today's workout only. (History, Plan C, decides how older sessions are viewed or edited.)
- **Workout name.** Dropped from the UI (Dylan: "I use it but it can go"). `Session.name` stays in the data model and is written as `""`.
- **Muscle map** (front/back anatomy figure, tap a muscle to see its volume). Dylan wants it; it belongs to the Progress tab in Plan C. Recorded here so it isn't lost.
- Templates / saved workouts (programs sub-project).

## Anti-goals (would make this a failure even if it works)

- Logging a set takes more taps or more thinking than the old app.
- Any typed number disappears after switching apps, a reload or an iOS page unload.
- The app makes him think in RIR or RPE numbers.
- The coaching nags: reasons are one sentence, the fatigue card appears once, nothing changes without his tap.

## Constraints

- Data rules from `CLAUDE.md`: never lose user data; changes to the stored doc need a migration if the shape changes (this plan needs **no** shape change: it uses `Session`, `Block`, `SetEntry` as the engine defined them); backup export/import keeps working.
- Built on Plan A's primitives, motion layer, stores (`appStore` with commit queue, `uiStore` on `overload.v2.ui`) and tokens. Apple-design rules from Plan A apply: interruptible springs, undo over confirmation, reduced motion → fades, 16px inputs, rem type tokens, phone width first (no horizontal overflow at 320px).
- `SetEntry.orig` must be cleared when a set's weight is edited (engine spec, unit-switch round trips).
- Engine stays pure; the Log calls `targetsFor`, `weeklyVolume`, `fatigueSuggestion`/`decideFatigue`, `liftHistory`, `warmupRamp`.

## The screen (layout B, decided with Dylan)

Top to bottom, at phone width:

1. **Header:** the shell's large title is replaced on this tab by a compact line: today's date and the workout's elapsed time since the first set ("Sat, Oct 18 · 0:42"); the gear stays.
2. **Exercise chips:** one chip per exercise logged today, in order, the current one highlighted. Tapping a chip makes that exercise current (to add a set or fix one). Chips are for going *back* only — there is no ＋ chip.
3. **Current exercise:** name (large), then "Set 2 of 3 · last set 2:14 ago" (working sets logged / the number of sets the engine asks for today, `LiftTargets.sets.length` — so a lighter week reads "of 2" (*my call*); the counter ticks each second, shows nothing before the first set of the day).
4. **Target | Last time**, side by side:
   - Target: weight × reps for the next working set (from `LiftTargets.sets[i]`, with `weight`) and the aim as difficulty words ("Moderate–Hard"). Below the pair: the engine's one-sentence `reason`.
   - Last time: the previous session's top working weight × reps, plus the rep list ("10 · 10 · 9").
   - **First time on an exercise** (engine rule `first-time`, weight `null`): Target reads "First time: pick a weight you could do for {repLow} reps"; Last time is empty.
5. **Warm-up hint** (only before the first working set of this exercise today): the suggested ramp from `LiftTargets.warmups` as text ("Warm-up: 70×8 · 105×4"). It is a hint only — nothing is auto-logged.
6. **Entry row:** weight and reps inputs (16px, numeric keypads), prefilled from the target for the next set (weight from the target, reps from that set's target); then the **difficulty** segmented control; then **Log set** (primary). A small "Warm-up" toggle on the entry row marks the set as a warm-up; warm-up sets don't take a difficulty. **The toggle starts on** for an exercise with no working sets today, so warm-ups cost no extra tap; he flips it off for his first working set, and once a working set is logged it stays off for that exercise (decided with Dylan). While it's on, the weight prefills from the next warm-up in the suggested ramp (or the last warm-up he typed, if he's past the ramp).
7. **Today's sets for this exercise:** list, warm-ups marked "W", working sets numbered with their difficulty word.
8. **Docked at the bottom, above the tab bar:** **＋ Next exercise** — always in thumb reach regardless of scroll.

Empty state (no sets today): the chips row and current exercise are absent; the screen shows a short line ("Start with any exercise") and the docked **＋ Next exercise** button (also shown as the primary action in the empty state).

## Difficulty (decided with Dylan)

Four words on the set entry; the engine keeps its RIR numbers internally:

| Word | Meaning | Stored `rir` |
|---|---|---|
| Easy | could've done several more | 4 (= "4+") |
| Moderate | a few more in me | 2 |
| Hard | maybe one more | 1 |
| All out | nothing left | 0 |

- Reading: `rir` 4 → Easy, 2–3 → Moderate, 1 → Hard, 0 → All out (`rir` 3 only exists if set by old data or settings; it reads as Moderate).
- An aim range (`rirLow..rirHigh`) shows as "{word(rirHigh)}–{word(rirLow)}", collapsed to one word when both map to the same word. Defaults today: hypertrophy 0–2 → "Moderate–All out", strength 1–2 → "Moderate–Hard".
- **Settings → Style rules** changes the "Target RIR low/high" number fields to an **"Aim for"** range picked from the same four words (two pickers: easiest and hardest). Writing: All out = 0, Hard = 1, Moderate = 2, Easy = 4. The low ≤ high pair rule and the Wave-3 pending-pair behavior still apply.
- **Difficulty is required for working sets** (*my call*): Log set stays disabled until one is picked, so the engine always gets a rating. To keep it one tap, the control starts with nothing selected and the last-used word for that exercise today is *not* carried over (a carried-over rating would be logged without thought). `rir: null` remains valid in data (old/imported sets).

## Picking the next exercise (decided with Dylan)

**＋ Next exercise** opens a sheet (Plan A `SheetStack`):

1. **"Still short this week"**: the `weeklyVolume` rows with status `under`, most-short first, each with a bar and "4/10" (sets / low). If nothing is under, the section says so in one line ("Every muscle you train is on track this week"). No exercise suggestions.
2. **Search** your exercises (non-archived), then the list grouped by body region with muscles as subtitles (reuse the library list).
3. "Add from the library" at the bottom pushes the existing Plan A Add-exercise view; adding one there returns to this picker with it selected.

Picking an exercise closes the sheet and makes it current. If it's already in today's session, it just becomes current (no duplicate block).

## Logging, fixing and removing sets

- **Log set** appends a `SetEntry` `{ weight, reps, warmup, rir }` to the current exercise's block in today's session, creating the session and block if needed. Then: the entry row refills from the next set's target, the "last set" counter restarts, and the new set appears in the list.
- Validation: weight ≥ 0 (0 is valid for bodyweight lifts), reps ≥ 1 whole number; invalid input explains itself (existing `NumberField` messages).
- **Fixing a set:** tap it in the list → it loads into the entry row in an "Editing set 2" state with **Save** and **Cancel** (*my call*). Editing the weight clears `orig`.
- **Removing a set:** swipe it left (1:1 drag, momentum, rubber-band) → removed with an **Undo** toast; also reachable from the editing state for keyboard/VoiceOver users (*my call*). Removing a block's last set removes the block; removing the session's last block removes the session — all covered by the same Undo.
- **Removing an exercise from today:** a "Remove from today" action on the current exercise when it has no sets is unnecessary (an exercise with no sets has no block — the block is created on the first logged set, *my call*). With sets, remove sets as above.

## What counts as "today's workout" (*my call*)

The Log shows the session dated **today** (local calendar day). Exception for late workouts: if the most recent set in the latest session was logged less than **3 hours** ago, the Log stays on that session even after midnight, so a workout crossing midnight isn't split. Sets get the session's date, not the wall-clock date, and **every engine call while that session is on screen uses the session's date as `today`** (targets, Last time, weekly volume week, fatigue, phase lookup), so nothing shifts at midnight (*my call*). (`SetEntry` has no timestamp; store "last logged at" in `overload.v2.ui` alongside the draft, which is enough for this rule and the "last set 2:14 ago" counter.)

There is no Finish button; the workout simply ends.

## Never losing input (Dylan's one complaint)

- The **draft** — current exercise id, the entry row's raw text (weight, reps), the selected difficulty, the warm-up toggle, the editing-set state, the test-day toggle state — is written to `overload.v2.ui` on **every change** (debounced at most ~250 ms, and flushed on `visibilitychange` → hidden and `pagehide`).
- On load, the draft restores **silently** to exactly where he was (no Resume/Discard prompt — that's the old design spec's text, superseded here because the draft belongs to the session that's still on screen).
- A draft whose session date is no longer the Log's day (see above) is dropped.
- Logged sets themselves go straight to the stored doc through `appStore.commit` (already persisted).
- `overload.v2.ui` stays excluded from backups.

## Targets are fixed for the day (decided with Dylan)

Targets don't react to how earlier sets went during a workout; the engine adjusts next time from the whole session. Every engine call the Log makes (`targetsFor`, Last time, and the reason) runs on the doc **with today's session left out** (a small wrapper in the Log feature; the engine itself is unchanged). "Last time" is the previous session of that lift before today. The entry row's prefill for set *n* is `targets.sets[n-1]` (beyond the target count: the last target set repeated). The fatigue suggestion also leaves today's session out, so a half-finished workout can't make the card pop up mid-session (*my call*). Weekly volume reads the full doc, so today's sets count toward this week's volume.

## Engine features surfaced on the Log

- **Reason:** `LiftTargets.reason` under the Target/Last pair, one line, secondary text.
- **Test day:** a "Test day" switch in a small "More" menu on the current exercise (not on the main row). On: `targetsFor(..., { test: true })`, the target area shows the work-up `ladder` of singles; the block is created with `test: true`. Not offered for bodyweight, assisted or band lifts (engine spec). The switch is available only **before the first working set** of that exercise today (warm-ups don't count); after that it's shown disabled with "Test day is chosen before your first working set" (*my call*: flipping a block with normal sets would silently drop them from progression, and a second block would break one-chip-per-exercise).
- **Fatigue week:** when `fatigueSuggestion` returns one and it hasn't been decided for that week, a single card at the top of the Log: "Most lifts were down this week — take a lighter week?" with **Accept** and **Dismiss** → `decideFatigue`. Accepting changes targets for 7 days (engine); the card then disappears.
- **Weekly volume:** in the Next-exercise picker (above).

## Testing

- Unit/integration (vitest, real stores on a memory KV, userEvent), like Plan A: logging creates session/block/set; difficulty mapping both ways and the range wording; Log set disabled without a difficulty on working sets; warm-ups take none and are excluded from "Set n of m"; first-time state; fix a set clears `orig`; swipe-delete + Undo restores exactly, including cascaded block/session removal; picker shows under-volume rows most-short first and the on-track line; picking an exercise already in today's session doesn't duplicate; test-day toggle passes `test: true` and creates a test block; fatigue card Accept/Dismiss writes `coaching.fatigueWeeks` and disappears; the 3-hour midnight rule; Style rules "Aim for" writes the right RIR numbers.
- **Draft durability:** type a weight and reps, pick a difficulty, simulate `visibilitychange`/`pagehide`, unmount, remount from the same KV → every field is back; a draft from a previous day is dropped.
- Browser walk at phone width (light, dark, reduced motion, 320px), like Plan A Task 10; the Wave-3 checks Dylan does on the Mac.
- Gates: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Left to the builder

Component and file layout under `src/features/log/`; how the entry row's prefill and "next set" are derived from `LiftTargets` when he's done more or fewer sets than the target count (beyond the target count: prefill repeats the last target set); exact copy beyond the strings above; the swipe-delete thresholds (reuse `gesture.ts`); how the elapsed-time and "last set" counters tick (one shared interval); chip overflow behavior (horizontal scroll); the warm-up hint's exact format; animation details within Plan A's motion rules.
