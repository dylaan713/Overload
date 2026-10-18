# Overload rewrite — Sub-project 2: Design system, shell and full-parity UI

Date: 2026-10-09 (revised 2026-10-17 after an Apple-design audit; target is now the iOS App Store) · Branch: `rewrite` · Status: approved, revised (again 2026-10-17b, see first section)
Depends on: `2026-10-09-foundation-design.md` (done: TS/Vitest, v2 store, migration, backups, ported engine).

## Revision 2026-10-17b: training engine model and Apple-design interaction (supersedes conflicting text below)
Owner direction: a **whole new UI**, not a reskin of the live app, built on Apple's design principles (the `apple-design` skill: response, direct manipulation, interruptible springs, spatial consistency, materials, typography, the eight principles). The engine spec (`2026-10-17-training-engine-design.md`) replaces the data model. Where this section and the text below disagree, this section wins.

**Data model (from the engine spec).**
- The app starts empty. There is no migration banner.
- Legacy keys are never touched. Settings → Data & backup offers "Download old app data" when they exist.
- Backups import v2 only; a v1 file shows "This backup is from the old app and can't be imported".
- Exercises come from the built-in library, or are user-created with equipment, muscles and compound/isolation. There are no muscle groups, no custom groups and no type badge.
- Settings are Units (switching **converts** logged weights after a confirmation that shows the count), Training style (current style, its start date, editable style rules), Equipment steps, Appearance, Exercise library and Data & backup. Increment, the compound/isolation rule cards and the rest-timer default are gone: rest now comes from the style.
- The parity appendix rows for groups, increment, unit relabel, type badges and the old suggestion wording are retired. Coaching UI is specified in Plan B against `targetsFor`.

**Interaction (moves into Plan A; no longer deferred to "sub-project 3").**
- Motion and visuals are designed together. Anything that moves in response to touch uses springs from the `motion` library (pinned `motion@13.5.1`, MIT, owner-approved 2026-10-17): critically damped by default, a little bounce only after a flick.
- Animations start from the current on-screen value, inherit release velocity and never block input.
- Sheets slide up and dismiss down the same path. They follow the finger when dragged down (rubber-band when dragged up) and decide close vs. stay by projected momentum (Apple's projection, deceleration 0.998). The page behind scales back and dims in step with the drag.
- Inside a sheet, views push in from the right and pop back to the right; an edge swipe goes back.
- The segmented control's thumb slides between options.
- Chrome (header, tab bar) is a translucent material shown only where content scrolls under it, with a soft edge instead of a hairline.
- Pressed states appear on touch-down.
- Reduced motion turns slides into cross-fades. Reduced transparency makes chrome solid. More contrast strengthens edges.

**Agency (owner-approved 2026-10-17).**
- Removing an exercise means **Archive**: it is hidden from pickers, keeps its history, shows an Undo toast and can be restored.
- Permanent delete sits one level deeper, behind a confirmation that states how many sessions it removes.
- Confirmations are reserved for irreversible actions: permanent delete, import replace and unit conversion. Everything else is undoable, and validation is inline.

**Wayfinding.**
- Tabs are **Log · Progress · History** (owner-approved; "Progress" names its contents: charts, records, weekly volume).
- Settings is a sheet opened from the header's gear, with Done.
- The Exercise library is a view inside that sheet, with Back.

## Intent
Replace the 2,150-line `src/App.jsx` with a TypeScript UI built on the foundation: a premium, minimal, readable visual identity and **every existing feature, unchanged in function**. The owner's rule: *design must never compromise functionality.* The active-workout redesign, gestures/animation, programs, PRs, RPE and the engine redesign are separate later sub-projects.

Decisions made with the owner: direction = premium minimal (B1 layout: stacked cards, target card, set list, hairlines); one identity with automatic light/dark (no theme picker); palette = "Midnight" with a neutral teal accent; typeface = system font (San Francisco on Apple devices; changed from Inter on 2026-10-17 for the App Store target) with tabular numerals + JetBrains Mono for set logs; scope = full parity with a new look (not a workout-flow redesign); four behavior fixes included (below).

## Scope
In: design tokens and primitives; app shell and navigation; Log, Manage exercises, Stats (Charts, Records), History, Settings, Rest timer, error boundary, loading state; Zustand store over the foundation data layer; first-launch persisting migration; cutover from `App.jsx`; tests including a contrast test and Playwright flows.
Out: active-workout mode, gestures/animation (sub-project 3); programs (4); PRs/RPE/volume/engine redesign (5); native wrap (6). The progression engine's rules do not change.

## Visual system
- **Tokens** in `src/styles/tokens.css` as CSS variables, redefined for light under `prefers-color-scheme: light` and `[data-theme]` overrides.
  - Dark ("Midnight"): bg `#0E1118`, surface `#161A24`, line `#222836`, text `#E9EDF5`, muted `#7D879B`, accent `#3FD0C9`, on-accent `#04191A`.
  - Light: bg `#F6F4EF`, surface `#FFFFFF`, line `#E4E0D6`, text `#15181F`, muted `#5F6675`, accent `#0B7F7A`, on-accent `#FFFFFF`. If the contrast test rejects any pair, adjust the value (not the threshold) and note it in the commit.
  - Semantic colors: increase = accent, decrease/warm-up = amber, stall/danger = red; each pair must pass contrast in both themes.
- **Type**: the system font stack (`-apple-system, BlinkMacSystemFont, system-ui, …`; San Francisco on iPhone/Mac, no webfont download) with `font-variant-numeric: tabular-nums` on all numerals; JetBrains Mono (already bundled) for set logs and the timer. Scale 13/15/17/22/28/40/64px. **No text under 13px**; inputs 16px (prevents iOS zoom).
- **Theme setting**: `settings.theme` becomes `"system" | "dark" | "light"` (default `system`). Legacy values (`ember`, `slate`, `violet`, `paper`) are mapped to `system` at read time; the stored value is not rewritten until the user changes it.
- **Readability gate**: a unit test computes WCAG contrast for every text/background token pair in both themes and fails below 4.5:1 for body/small text and 3:1 for large numerals (≥24px or ≥19px bold).
- **Layout**: mobile-first, max width 720 centered, safe-area insets honored, 16px side gutters, ≥44px tap targets, no horizontal scroll.
- **Type tokens in rem** (`--text-xs`…`--text-4xl` = 13…64px at a 16px root) with paired leading and negative tracking for large sizes. On iOS the root is `font: -apple-system-body`, so the whole UI follows the user's text-size setting (Dynamic Type) in Safari and in the native wrap. Inputs are never under 16px.
- **Touch feedback**: every pressable control shows a pressed state on touch-down (≤100ms); hover styles only under `@media (hover: hover)`; no tap-highlight flash or double-tap delay.
- **Motion, materials, accessibility tokens** are defined now even though animation work is later: duration/easing tokens, a translucent `--material` for chrome, and overrides for `prefers-reduced-motion` (slides become fades), `prefers-reduced-transparency` (solid chrome) and `prefers-contrast: more` (stronger hairlines, muted text ≥7:1).

## Architecture
- React 19 + TypeScript (strict), CSS Modules + tokens, Zustand store, Recharts (restyled). No Tailwind, no runtime CSS-in-JS.
- `src/ui/` primitives: Button, IconButton, Card, Field, NumberField, Segmented, Badge, Pill, Collapsible, EmptyState, Toast.
- `src/features/{log,exercises,stats,history,settings,timer}/` one folder per screen with components, tests and CSS modules.
- `src/state/store.ts`: wraps `bootStore`/`saveDoc`; exposes selectors (`entriesByExercise`, suggestions via the domain engine) and actions mirroring today's behavior (add/edit/remove block, upsert session by date, cascade delete exercise, add group, update settings, import/export). Every mutation writes the whole v2 doc once; a write failure surfaces a visible error and rolls back in-memory state.
- `src/app/`: shell (header with title and gear; **bottom** tab bar Log/Stats/History with icons, translucent, above the home indicator), loading and error screens, ErrorBoundary. **Settings is a modal sheet** opened by the gear (Done / Escape close it, the page behind is inert); **Manage exercises is the sheet's "Exercise library" view** with Back to Settings, not part of the Log card. The rest timer docks directly above the tab bar.
- Engine stays in `src/domain` untouched.

## Persistence and migration at launch
- On first launch the app calls `bootStore(kv)` (persisting). v1→v2 copies the four legacy keys into `overload.v2`; legacy keys are never modified. A one-time banner states "Your data was copied" with a backup-download button. If boot throws, the error screen offers "Download raw data" (**including `overload.v2` when present**, closing the foundation's deferred minor).
- **Transient UI state** lives under a separate key `overload.v2.ui`, excluded from backups: active tab, log date, in-progress set rows, `editingBlockId`, selected exercise, new-exercise form fields, Stats/History view state, and the rest timer's `endAt` + duration. If an unsaved draft exists after reload, show **Resume / Discard**. A timer whose `endAt` passed while closed shows "Done".
- Backups use the foundation's `exportBackup` (v2) and `importBackup` (v1 and v2).

## Behavior fixes (the only intentional changes)
1. **State survives tab switches and reload** (timer keeps running between tabs; set rows, selections and view state persist) via the `overload.v2.ui` store.
2. **Decimal keypad for weights** in the set editor (`inputMode="decimal"`); reps stay numeric.
3. **Undo instead of silent delete** when removing an exercise block from a day (toast with Undo for ~6s; deleting the last block still removes the session once the toast expires or is dismissed).
4. **Clear validation messages** instead of silent no-ops/reverts: blank exercise name, no valid set rows, out-of-range or non-numeric settings, and failed imports each explain themselves. Import shows counts (exercises/sessions) and asks for confirmation before replacing; v1 import is documented as a full replace.

Everything else matches the parity appendix below, including quirks that are product decisions (one session per date, unit relabel without conversion, unit change resets increment, "Done" auto-dismiss after 5s, etc.).

## App Store readiness (new 2026-10-17)
The app ships to the iOS App Store via the Capacitor wrap (sub-project 6), so the web UI is built to pass review and feel native from the start:
- **Native conventions**: bottom tab bar, sheets with Done, Back in nested views, no hidden pseudo-tabs, system accessibility settings honored (Dynamic Type, reduced motion/transparency, more contrast, VoiceOver labels on every icon button).
- **Platform seams**: file export goes through `downloadText` only (an `<a download>` does not work inside WKWebView; the wrap swaps in the iOS share sheet); storage goes through `KeyValueStore` only (iOS can evict WKWebView localStorage, so the wrap moves `overload.v2` to native storage with a one-time migration); haptics and notifications get the same one-module treatment when they arrive.
- **Guideline 4.2 (minimum functionality)**: a plain wrapped website risks rejection. The native wrap must add real device features: rest-timer local notifications, haptics on set completion and timer end, and optionally writing workouts to Apple Health.
- **Privacy**: no network calls and no accounts, so the privacy label is "Data Not Collected"; a hosted privacy-policy page is still required (Stage C).

## Testing
- **Parity tests**: component tests (Vitest + Testing Library + jsdom) each tagged with the appendix item they cover; every appendix row maps to a test or is marked "visual-only" and covered by screenshot review.
- **Store tests**: upsert-by-date, cascade delete, undo, write-failure rollback, ui-state restore, theme mapping.
- **Contrast test** as above (blocking).
- **Engine and data**: existing 62 tests keep passing; golden tests unchanged.
- **Playwright e2e** (against a copy of the real fixture loaded into localStorage): first-launch migration, log a workout with warm-ups, suggestion banner states, rest timer across tabs and reload, history edit-navigation, chart + records, export/import round trip, light and dark screenshots of every screen reviewed by the owner.
- Gate per task: `npm test && npm run typecheck && npm run lint`; `npm run build` before cutover.

## Cutover and rollback
- New UI becomes the entry of `index.html` on `rewrite`; `src/App.jsx`, `src/storage.js` and `src/index.css` are deleted only after every parity row is checked and e2e passes. `/dev.html` stays until the owner confirms on the phone.
- Merging to `main` auto-deploys to Netlify and is the owner's decision. Rollback = Netlify rollback to the previous deploy: the old app still sees untouched legacy keys, but anything logged after cutover exists only in `overload.v2` and will not appear in the old app.

## Risks
- Largest UI surface so far; mitigated by the parity appendix, per-feature tests and screenshot review.
- Light theme contrast is easy to get wrong; mitigated by the blocking contrast test.
- Transient-state restore could resurrect a stale draft; mitigated by Resume/Discard and keying drafts by date.
- `fixtures/` data is local-only; CI uses the synthetic fixture.

## Success criteria
1. Every row in the parity appendix is kept or listed as one of the four fixes.
2. Real data loads with identical counts (41 exercises, 57 sessions at spec time) and round-trips through export/import.
3. Contrast test passes in both themes; no text under 13px.
4. All tests, typecheck, lint, build and e2e pass; owner approves screenshots on a phone-sized viewport in both themes.

---

## Appendix: feature-parity checklist (from `App.jsx` inventory, 2026-10-09)

**Data/persistence** — 4 localStorage keys → now `overload.v2`; one session per date (upsert by date; empty blocks ⇒ session removed); `mergeSettings` for partial/old settings; ids via `uid()`; unit is a label only; fixed groups Chest/Back/Shoulders/Legs/Arms/Core + custom + any group used by an exercise; missing group buckets as "Other"; local-date `ymd` (never UTC).

**Shell** — title "Overload" with icon; gear → Settings (now a sheet, was a pseudo-tab); tabs Log/Stats/History (now at the bottom); loading text while data loads; ErrorBoundary ("Something broke", Reload button, error text).

**Log** — date input (default today, local); workout name ("e.g. Push Day, Leg Day..."), autosaves only once blocks exist, otherwise saved with first block, empty allowed (History shows "Workout"); "Exercises on {date}" card with name, type badge, group, set pills, "(deleted exercise)" fallback, edit pencil and remove X; add/edit card ("Add exercise"/"Editing exercise"); "Manage exercises"/"Close" toggle; "+ New exercise" (hidden while editing; auto-open when no exercises); exercise picker grouped by muscle group, shows "{name} — {type}", disabled while editing, falls back to first exercise; new-exercise form (name, compound/isolation toggle with target-range hint, group select + "+ New group" free text/"Use list", "Add exercise"; blank name ignored; trimmed; custom group not added to `customGroups`); suggestion banner and warm-up ramp shown only with an active exercise, form closed, not editing; they and the "Last · {date}" card use prior entries **excluding the date being edited**; set editor (rows weight × reps, Working/Warm-up toggle, remove row, "+ Add set"; rows missing weight or reps dropped; "Add to workout"/"Save changes"/"Cancel"); edit loads sets as strings and keeps id/position; "Add to sets" keeps manual non-warm-up rows, drops warm-up rows, appends blank row.

**Manage exercises** — add group (trim, case-insensitive duplicate ignored); "No exercises added yet."; every group listed incl. empty ("No exercises yet — it'll show up when you add one to this group."); row view (name, badge, edit, delete) and edit (name, group, type, save; blank name keeps old; no cancel); delete → red "Confirm delete" → cascade removes the exercise's blocks and any emptied sessions.

**Suggestions (engine unchanged)** — statuses no-data/no-working-sets (hidden), increase (incl. big jump), decrease, stall, add-reps; wording: "Move up to {to} {unit}", "Big jump — {to} {unit}", "Deload to {to} {unit}", "Drop to {to} {unit}", "Aim for {targetReps} @ {weight} {unit}", "Last {w}×{reps…} → {targetSets…}", plate indicators; subtexts as in the current app; target weight feeds the warm-up ramp.

**Warm-up ramp** — label "Warm-up · target {w} {unit}"; count from settings; 45%→90%, reps 8→3, rounded to 2.5 kg/5 lb; filters ≤0 and ≥ target; "+ Add to sets".

**Rest timer** — idle card with "Rest timer" and "Customize" (→ Settings); presets {60,120,180,default} deduped/sorted as m:ss; running bar fixed at bottom (countdown, −15s, +15s, reset to starting duration, Skip); timestamp-based, 250ms tick; "Done" state with Dismiss, auto-clears after 5s; no sound/vibration/notification (until native).

**Stats** — Charts/Records toggle; exercise picker; target range; "No sessions logged yet."; metric toggle Est. 1RM (default) / Weight; per-session point = heaviest working set and max e1RM; null gaps bridged; y-domain ±5; tooltips "{val} {unit} est." and "{val} {unit} × {reps} reps"; "Session log" newest first; no time range selector. Records: collapsible groups (open by default) with counts; per-exercise Heaviest set, Best @ {top}+ reps (current settings), Most reps, Sessions logged (+ latest date); empty states "Log a workout to see charts." / "Log sessions to build records." / "No working sets logged yet."

**History** — month calendar, Su–Sa headers, prev/next, worked-day dot, today border, selected highlight, toggle selection, only worked days tappable; day detail (name or "Workout", date, "Edit" → Log on that date, blocks with badges and pills); hints "Tap a highlighted day to see that workout." / "No workouts logged yet."

**Settings** — unit lb/kg (resets increment; "Relabels only; won't convert logged numbers."); increment ≥0 decimals; per type: sets to advance ≥1, warm-up sets ≥0, rep range low/high (low < high), live hint "{repTop}+ × {sets} set(s) → +{increment} {unit}."; rest default seconds ≥5; theme (now System/Dark/Light); Data & backup: export `overload-backup-{date}.json`, import with success/failure messages; commit-on-blur/Enter number fields.

**Edge cases to keep** — local dates; edit-date exclusion for suggestions; highest qualifying weight wins increase; warm-up-only sessions skipped in stall run but counted in "Sessions logged"; unit change overwrites increment; last block removed ⇒ session removed (undo window added); deleted-exercise cascade; silent duplicate-group ignore (now with a message under fix 4); unknown exercise type uses compound rules in suggestions.
