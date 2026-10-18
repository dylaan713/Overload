# Handoff
Last updated 2026-10-09 (rewrite branch).

## Status
Overload is a workout-logging PWA (React 19 + Vite 6, data kept on-device in localStorage, no backend). It has a Log / Stats / History nav, double-progression coaching, warm-up ramps, Est. 1RM charts, a rest timer and backup export/import. Stage A of `PUBLISHING.md` is done: the app is live on Netlify and every push to `main` auto-deploys through Netlify. Native store builds (Stages B and C) have not started. The repo has a lint script but no tests, and `README.md` is still the Vite template boilerplate.

## Next
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
