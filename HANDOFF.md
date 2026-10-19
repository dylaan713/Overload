# Handoff
Last updated 2026-10-09 (rewrite branch).

## Status
Overload is a workout-logging PWA (React 19 + Vite 6, data kept on-device in localStorage, no backend). It has a Log / Stats / History nav, double-progression coaching, warm-up ramps, Est. 1RM charts, a rest timer and backup export/import. Stage A of `PUBLISHING.md` is done: the app is live on Netlify and every push to `main` auto-deploys through Netlify. Native store builds (Stages B and C) have not started. The repo has a lint script but no tests, and `README.md` is still the Vite template boilerplate.

## Next
State Update 2026-10-19 (pre-merge fixes): fixed the review's known minors (wrong set after Undo while fixing, bodyweight "0 × 10", calendar month on the 1st, sparkline without data, assisted Last time, two VoiceOver gaps). Note: after any future deploy the app may reload itself a few seconds after opening (service worker autoUpdate); typed drafts are saved first. 568 tests, typecheck, lint, build green.
Next: merge `rewrite` into `main` and push (Dylan said yes); then Dylan opens the app twice on the phone and re-adds it to the home screen for the new icon.

State Update 2026-10-19 (audit fixes): an exercise-science audit agent reviewed the engine (sound on progression and intensity). Fixed items 1–4 with tests: effective-set volume (Easy ½, test singles 0), lighter week halves the volume range, "over 20" warns only when lifts stall, hypertrophy compounds aim Moderate–Hard. 561 tests, typecheck, lint, build green.
Next: Dylan's yes → merge `rewrite` into `main` and push. Deferred from the audit: lengthened-position tags + hints (with deadlift/squat tagging), frequency info, cardio log, faster rep targets.

State Update 2026-10-19 (Plan C wave 4): angled teal dumbbell icon; cutover committed on `rewrite` (index.html runs the new app, old app + /next.html + /dev.html + recharts/old fonts removed, SW registered from src/main.tsx; local old→new swap test: 1st open old app, 2nd open new app, old data kept). Final review: 0 Critical, 4 Important all fixed with tests (no verdicts before 2 weeks; bodyweight/assisted scoring; one measure per lift chart; Repeat keeps the whole workout queued); 8 minors deferred in the ledger. 558 tests, typecheck, lint, build green. README written.
Next: Dylan's yes → merge `rewrite` into `main` and push (deploys production). On the phone: open the app twice; remove and re-add it to the home screen for the new icon. Then a month of testing; deferred minors and Stage B (Capacitor) after.

State Update 2026-10-19 (Plan C wave 3): Tasks 7–9 done — History calendar (swipe between months), workout sheet (view/fix/remove past sets with Undo), Repeat this workout (first exercise on the Log, rest in "Up next"). Also from Dylan's wave-2 feedback: Progress split Lifts·Muscles, one-line reasons (max 2), full reason on the lift chart, readable empty plates in light mode. Browser walk found and fixed a clipped Saturday column at 320px. 541 tests, typecheck, lint, build green.
Next: Dylan's go for wave 4 (pick 1 of 3 icon concepts, then cutover + final review; merge to main only on his yes).

State Update 2026-10-19 (Plan C wave 2): Tasks 4–6 done — geometric muscle figure + map tones (3:1 tested), Progress tab (This week/Strength map, headline, Needs attention, lift list with sparklines), lift chart sheet (4 wk/3 mo/1 yr, phase marks, test-day dots, drag/arrow-key readout). Fix: "add sets" averages only full weeks since the first workout; stall line states real weeks. 518 tests, typecheck, lint, build green; browser check 390 light / 320 dark.
Next: Dylan's go for wave 3 (History calendar, workout sheet with fix/remove, Repeat).

State Update 2026-10-19 (Plan C wave 1): spec + plan written and approved (`docs/superpowers/specs/2026-10-19-progress-history-cutover-design.md`, `docs/superpowers/plans/2026-10-19-progress-history-cutover.md`; native execution). Tasks 1–3 done: Progress math (8-week trends; difficulty trusted only at Moderate or harder; Needs-attention reasons), muscle-map states, History day summaries + Repeat queue (UI state v4). 484 tests, typecheck, lint, build green. Rulings: `.superpowers/sdd/2026-10-19-progress-history-cutover/progress.md`.
Next: Dylan's go for wave 2 (muscle figure, Progress screen, lift chart).

State Update 2026-10-19 (Log signed off): Dylan tried the Log on the Mac (production preview) and signed it off. He reviewed weekly volume and kept it as is (one range per style for every muscle; front/side/rear delts tracked separately). No code changed.
Next: Plan C (Progress + History + muscle map + cutover) via brainstorming.

State Update 2026-10-18 (Log polish wave): untouched set fields now show the target as real text (focus selects it; a cleared field must be filled; UI state v3, v2 drafts upgrade); focus lands on the weight field after a pick, back on the set after Save/Cancel, a neighbour after Delete (sheets now return focus to their opener, not always the gear); on screens under 700px tall Next exercise follows the sets; units on Target/Last time, "Weight, lb" name, "Pick a difficulty to log", volume reads "4 of 10 sets"; empty Log opens the picker with search focused, a new account opens straight into library search, no volume list before any training. 438 tests, typecheck, lint, build green; browser walk at 320×640 and 390×844 passed (commits 87ddb6d..cb5c07a).
Next: Dylan tries it (`npm run build && npx vite preview`, /next.html, reload twice); then Plan C (Progress + History + muscle map + cutover) via brainstorming.

State Update 2026-10-18 (Log feedback): Dylan tried the Log. Fixed: difficulty always shown and picking one makes a working set (warm-up switches off); a new exercise starts with warm-up off; selected difficulty/warm-up use the solid teal fill (was invisible in light mode). 424 tests, typecheck, lint, build green (commits 0f7b824, ccb2ce9). Dylan: "warm up looks fine now."
Next: Dylan's call on the rest of the Log (grey placeholder-as-prefill look, focus after edit/remove, dock covering difficulty at 320px; offered: empty Log opens library search directly + "Pick a difficulty to log" hint); then Plan C (Progress + History + muscle map + cutover) via brainstorming. Preview: `npm run build && npx vite preview`, /next.html, reload twice (service worker serves the old build first).

State Update 2026-10-18 (Plan B: Log, all 3 waves): Log tab built on `rewrite` — one exercise at a time, fixed target beside last time, Easy/Moderate/Hard/All out (stored as RIR), warm-up switch on by default, draft saved on every keystroke + flushed on hide, Next-exercise picker with this week's short muscles, tap-to-fix / swipe-to-remove with Undo, test day, lighter-week card; Style rules use "Aim for" words. 3 fresh reviews: 1+0+1 Critical, 1+2+5 Important all fixed with tests; 421 tests, typecheck, lint, build green; browser walk at 390/320 done. Rulings + deferred minors: `.superpowers/sdd/2026-10-18-log/progress.md`.
Next: Dylan tries the Log on the Mac (`npm run build && npx vite preview`, /next.html; reload once if the old UI shows) and rules on the deferred items (placeholder-as-prefill look, focus after edit/remove, dock covering the difficulty row on short screens); then Plan C (Progress + History + cutover).

State Update 2026-10-18 (Task 10 checks): production preview passes at phone width (light, dark + reduced motion, 320px no overflow, Undo toast topmost over the sheet); a stale service worker from an old preview briefly served the old app, so on the phone open /next.html twice or clear site data if you see the old UI.
Next: Dylan tries it on the phone (VoiceOver reaches Undo, Export downloads, edit a field then edge-swipe back, motion feel); then Plan B (Log).

State Update 2026-10-18 (wave 3 review, fixes B): I4 (sheet modal via inert only, so VoiceOver reaches Undo/Dismiss), blur on Back/swipe-back, crash-screen raw download, confirm unit switch that resets changed steps; all with tests, 334 green.
Next: light/reduced-motion screenshots + production-preview check; then Dylan on the phone (VoiceOver reaches Undo, Export downloads, edit a field then edge-swipe back); then Plan B.

State Update 2026-10-18 (wave 3 review, fixes A): fresh review found 0 Critical / 4 Important / 12 Minor; Wave A fixed I1 (style-rule pair draft), I2 (custom loadKind follows equipment), I3 (library search focused on open) with tests, 330 green; ledger updated.
Next: Wave B = I4 (toast/alert inside the aria-modal sheet for VoiceOver) + blur on swipe-back, crash-screen data download, confirm unit switch that resets steps; then screenshots + production preview, then Dylan on the phone.

State Update 2026-10-18 (Plan A wave 3): Tasks 7–9 done (shell, Settings, Exercise library); Task 10 browser walk passed and found 3 bugs, all fixed with tests. 325 tests green. Try it: `npm run dev`, open /next.html.
Next: wave 3 fresh review (diff c874878..HEAD), then light/reduced-motion screenshots + production-preview check, then Dylan tries it on the phone; then Plan B.

State Update 2026-10-18 (Plan A wave 2): lossless unit switching (orig), Task 4 spring motion layer, Task 5 domain helpers, Task 6 stores. Fresh review: 1 Critical + 9 Important (+2 minors re-graded) all fixed with tests incl. real-animation interruption tests; 11 minors deferred in the ledger. 284 tests green.
Next: wave 3 = Task 7 (shell), 8 (Settings), 9 (Exercise library), 10 (device check + motion review), then a fresh review.

State Update 2026-10-17 (Plan A wave 1): Tasks 1–3 done on `rewrite` (toolchain + /next.html, tokens + contrast/typography gates, static primitives); fresh review found 7 Important (all fixed with tests), 9 minors deferred in `.superpowers/sdd/2026-10-09-ui-foundation/progress.md`. 209 tests green.
Next: wave 2 = Task 4 (spring motion layer), 5 (domain helpers), 6 (stores), then a fresh review.

State Update 2026-10-17 (Plan A revised): Plan A rewritten for the new engine model and a whole-new Apple-design UI (motion@13.5.1 springs, draggable sheets + in-sheet nav stack, sliding segmented, undo toasts, Log · Progress · History, archive + undo). Design spec has a 2026-10-17b revision section. 10 tasks, no UI code yet.
Next: Dylan reviews `docs/superpowers/plans/2026-10-09-ui-foundation.md` and picks the execution method; then execute in waves (1–3, 4–6, 7–10).

State Update 2026-10-17: Training engine done on `rewrite` (pure domain, no UI): new v2 model, start-empty boot, v2-only backups, exercise library (154), phases, step-aware targetsFor with setbacks/stall/time-off/fatigue/test-day, weekly volume. Old engine and golden tests removed. Final review fixed (step-grid snapping, step ≤ 0 hang, input validation); 113 tests green. 8 deferred minors and all rulings: `.superpowers/sdd/2026-10-17-training-engine/progress.md` (git-ignored).
Next: revise Plan A for the new model (no migration banner; Settings: Units, Training style, Equipment steps, Download old app data; library browser + Create your own), then Plan B on targetsFor.

State Update 2026-10-17 (wave 2): Engine plan Tasks 4–6 done (estimates + lift history; `targetsFor` with earn/extend/build/phase-start/bodyweight/band; bad-session, drop and stall rules with cooldown). 88 tests, typecheck, lint, build green.
Next: wave 3 = Tasks 7–9 (time off, fatigue week, test day, final precedence; weekly volume; verification + spec touch-up), then the final whole-branch review.

State Update 2026-10-17 (wave 1): Engine plan Tasks 1–3 done on `rewrite` (new v2 model + start-empty boot + v2-only backups; 154-entry exercise library; phases/steps/unit conversion). 54 tests, typecheck, lint, build green. Ledger: `.superpowers/sdd/2026-10-17-training-engine/progress.md`.
Next: wave 2 = Tasks 4–6 (estimates/history, `targetsFor` rules 1/2/8/10/11, setbacks 3–5), then wave 3 = Tasks 7–9 + final review.

State Update 2026-10-17 (later): Training engine spec written (`docs/superpowers/specs/2026-10-17-training-engine-design.md`): phases by style, exercise library + custom exercises, per-set RIR, step-aware progression, bad-day/stall/fatigue/layoff rules, weekly volume. Dylan chose to START EMPTY (no migration of old data). Spec approved; implementation plan written (`docs/superpowers/plans/2026-10-17-training-engine.md`, 9 tasks, pure domain, no UI).
Next: Dylan picks execution method (native recommended) and runs the engine plan; then revise Plan A for the new model; then Plan B.

State Update 2026-10-17: Apple-design audit done; Plan A and the design spec revised for an App Store target (bottom tab bar, Settings sheet, Exercise library view, rem/Dynamic Type tokens, press states, motion/material/a11y tokens, costed delete, local-date backup names). Still no UI code.
Next: brainstorm + write the engine redesign spec (per-exercise increments, bad-day tolerance, RPE/RIR, smarter stalls/deloads, layoffs, e1RM cap) before Plan B; execute Plan A in waves whenever Dylan can build.

State Update 2026-10-09 (end of day): On branch `rewrite` (not merged to `main`): foundation done (data layer, migration, ported engine, 62 tests) and specs/plans written. Design spec approved; UI Foundation plan (Plan A) written and awaiting Dylan's review and execution-method choice (native recommended). No UI code written yet.
Next: review `docs/superpowers/plans/2026-10-09-ui-foundation.md`, pick native or subagent-driven, execute. Then write Plan B (Log) and Plan C (Stats/History/e2e/cutover). Separate spec still needed for the engine redesign (smarter progression, RPE, better deloads). Open question: merge `rewrite` to `main` so /dev.html can confirm 41 exercises / 57 sessions on the phone (Dylan's call; main auto-deploys).

1. Stage B (`PUBLISHING.md`): wrap the app with Capacitor for native builds.
   - Choose the permanent bundle id (`com.YOURNAME.overload`).
   - Run the Capacitor setup and `npx cap add android`, then `npx cap add ios`.
2. After the Capacitor wrap, add `@capacitor/local-notifications` and wire an at-zero alert into `RestTimer` in `src/App.jsx`. The web sound and vibration alerts were removed because they don't fire in a backgrounded iOS PWA.
3. Stage C: store accounts, assets (1024 px icon, screenshots, descriptions), a hosted privacy-policy page, then Play internal testing and TestFlight.
4. Replace the boilerplate `README.md` with a real project description.
5. Question for Dylan: are you ready to start Stage B, or should the app stay a PWA for now? The repo doesn't say.

## Blockers
- Dylan: decide when to start Stage B and pick the bundle id.
- Dylan: Stage C needs paid accounts (Google Play $25 one-time, Apple Developer $99/yr).

## Last session
2026-10-09: Cloned the repo onto the Mac, which is now the only dev machine. Added this handoff and updated `PUBLISHING.md` for Mac-only development. No app code changed.

Previous session, 2026-07-21: Added a rest timer (1, 2 and 3 min presets plus a custom default), rep-aware double-progression coaching with a stall/deload path, an Est. 1RM chart toggle, and a merged 3-tab nav (Log / Stats / History). Then removed the timer's sound and vibration alerts because they were silent on iPhone, and documented a native local notification as the Capacitor follow-up in `PUBLISHING.md`.
