# Overload rewrite: Plan C — Progress, History, muscle map, cutover

Date: 2026-10-19 · Branch: `rewrite` · Status: ready for Dylan's review (builder check done)
Builds on: the training engine (`2026-10-17-training-engine-design.md`), Plan A (shell, Settings, library, motion) and Plan B (`2026-10-18-log-design.md`, signed off 2026-10-19). Design rules: the design-system spec (`2026-10-09-design-system-and-shell-design.md`, 2026-10-17b revision) and the `apple-design` skill, which Dylan asked every choice here to respect.
Mockups (git-ignored): `.superpowers/brainstorm/40445-1792418109/content/` — `progress-layout.html` (layout **A** chosen), `history-layout.html` (**calendar** chosen, plus the workout screen), `muscle-map-geometric.html` (the chosen geometric style).

## Intent

The Log is done. The Progress and History tabs are still placeholders, and the new app can't replace the live one until they exist.

How Dylan uses them (his words, condensed):
- **Progress:** "I just want to make sure I am making progress over time." He knows he is when the graph has "an overall positive slope". He wants both an overall answer and per-lift detail, but "information should actually be valuable and not clutter".
- **History:** he looks back "for workouts I enjoyed so I can copy what I did", because "it's easier to make progress following a structure". He finds them by remembering **roughly when** they were.
- **Muscle map:** shades that show "what hasn't been hit enough", and a way to "highlight progress" — two separate views. Geometric look, and muscles must be **easily identifiable**.
- **Cutover:** replace the live app once Progress and History are built; he'll test it for about a month and fixes ship as normal updates.

Success: one glance at Progress answers "am I getting stronger?"; finding and repeating an old workout takes a few taps; the new app is live on the phone.

## Goals

1. **Progress tab:** muscle map (two views) on top, then an overall headline, then a list of lifts with mini trend lines; tap a lift for its full chart.
2. **History tab:** month calendar; tap a training day to see its summary; open it to see every set; fix or remove past sets.
3. **Repeat this workout:** queue a past workout's exercises into today's Log, in order, with this week's targets.
4. **Cutover:** the new app becomes the live app at `/`, the old app's code is removed, and the switch is safe to roll back.

## Non-goals

- **Workout duration.** The mockup showed "52 min", but sessions store only a date — no times. Not shown (**my call**; recording times would need a data-model change for little value).
- **Two workouts on one day.** The data model has one session per date; History shows one per day.
- **Importing old-app data** into the new app. Dylan chose to start empty (2026-10-17); "Download old app data" in Settings stays.
- **Saved templates / programs.** Repeat copies a past workout once; it doesn't create a reusable template (programs sub-project).
- **Changing weekly-volume rules.** Dylan reviewed them on 2026-10-19 and kept them as they are.
- Rest timer, native wrap (later stages).

## Anti-goals

- Clutter: any number or chart on Progress that doesn't help answer "am I getting stronger?" or "what's short?".
- A muscle map where you can't tell which plate is which muscle.
- Repeat that overwrites or reorders anything already logged today.
- A cutover that strands the phone on the old app or loses anything logged in the new one.

## Progress tab

Top to bottom:

### 1. Muscle map
- **One front + back figure**, with a sliding segmented switch **This week · Strength** above it.
- **Style (Dylan):** geometric — flat faceted plates, a clean gap between plates, no realistic shading. Shapes follow each muscle's real outline in simplified form (two pecs, an ab grid, quads as a teardrop with a separate inner plate) so they're recognisable without labels.
- **All 19 tracked muscles** (`MUSCLES` in `src/domain/types.ts`) get their own plate(s), including front, side and rear delts separately. Head, hands, knees etc. are neutral base plates.
- Proportions must read as a believable body (the mockup's short legs and floating knees are not the target). Drawn as inline SVG paths in the repo (**my call**: no dependency; one source of truth for both views; tinted with CSS variables so light/dark come free).
- **This week view:** each muscle shaded by its weekly sets vs the current style's range, from `weeklyVolume` (same numbers as the Log's "Still short this week"): **None** (0) · **Under half** (< 50% of low) · **Almost** (≥ 50% of low, below low) · **In range** (low–high) · **Over** (> high). Over gets its own legend entry (**my call**, a distinct tone; the mockup didn't show it). Muscles not trained in the last 4 weeks show as None. Tap → panel below: "Side delts · 2 of 10–20 sets this week · add 8" (over: "24, above 20 — consider fewer next week").
- **Strength view:** each muscle colored by the average est. 1RM change over the last 8 weeks of lifts whose **primary** muscles include it: **Down · Flat · Up · Up a lot · No data**. Thresholds are the builder's call (suggest: flat = within ±2%, up a lot = ≥ +5%); a lift needs ≥ 3 sessions in the window to count (same rule as the headline). Tap → panel lists those lifts with their change; tapping a lift opens its chart.
- **Identifiable:** tapping outlines the plate and names it in the panel; small muscles (rear delts, forearms, side delts, calves) get an enlarged invisible hit area; every plate has a VoiceOver label with name and status ("Side delts, 2 of 10 to 20 sets"); the legend always pairs color with a word.
- **Colors:** the teal ramp from the app's tokens; Down = the app's amber. Light mode uses the same plates with light-theme tones. **Contrast (my call):** non-text fills follow WCAG 1.4.11 — every status tone except None reaches **3:1** against the panel background in both themes; None and the neutral base plates are exempt (they mean "nothing here"). Neighbouring tones only need to look clearly different; the word in the legend and the tap panel carries the meaning. Add these as new cases in `tests/styles/tokens.test.ts`.
- Switching views cross-fades the fills; the figure doesn't move (**my call**).

### 2. Headline
- "Stronger on **7 of 9** lifts" with "Average est. 1RM +6%" under it, over **the last 8 weeks**.
- A lift counts if it has ≥ 3 sessions in the window with working sets (**my call**, so one-off exercises don't swing it). "Stronger" = est. 1RM at the end of the window beats the start; how start/end are measured (e.g. best of the first vs last two sessions, to damp one bad day) is the builder's call — state it in the plan.
- Est. 1RM uses the existing `src/domain/strength.ts` helpers.
- **Difficulty ratings only count near failure** (Dylan, 2026-10-19: "do whatever gives the best possible coaching advice, be as critical as possible"). People judge reps-left well within ~2 reps of failure and badly far from it, and Easy is open-ended ("4+"). So a session's est. 1RM uses its Moderate / Hard / All-out working sets with reps + reps-left (capped at 12 as today); unrated sets count reps only; if every set that day was Easy, reps only (nothing added). Marking a set Easy can never make a lift look stronger. Coaching (targets) is unchanged.
- **Needs attention** (Dylan: "help actual improvement"): between the headline and the lift list, at most 3 counted lifts that are Flat or Down, each with one sentence saying why, picked from the data in this order: (1) mostly Easy sets in the window (average reps-left ≥ 3) → "Most sets were Easy. Take them closer to failure."; (2) Down while mostly All out (average reps-left ≤ 0.5) → "Every set was All out and it's dropping. Recovery is the limit; take the lighter week when the Log offers it."; (3) its main muscle under the weekly range this week → "{Muscle} gets {n} of {low}+ sets a week. Add sets."; (4) over half its sets unrated → "Most sets have no difficulty, so coaching can't judge them. Tap one after each set."; (5) otherwise → "No gain in 8 weeks. The Log changes the target when a lift stalls; follow it." The group isn't shown when nothing needs attention.
- **Test days count** (**my call**): a test day's working sets are the most direct strength reading, so they feed the headline, trend lines, Strength map, lift chart and Best set, and count as a session for the ≥ 3 rule. `liftHistory` excludes test blocks for coaching, so Progress builds its own per-session est. 1RM series. On the lift chart a test day is a filled dot with a "Test day" label when scrubbed.

### 3. Your lifts
- One row per non-archived exercise with working sets in the last 8 weeks: name, mini trend line (est. 1RM per session), change in the user's unit ("+15 lb" / "flat" / "−10 lb").
- Line color follows direction (teal up, grey flat, amber down); the text always says it too.
- Order: most-trained in the window first (**Dylan approved the guess**).
- Lifts with 1–2 sessions show "Not enough data yet" instead of a line.

### 4. Lift chart (pushed view)
- Tap a lift → its chart slides in (in-sheet/nav push like the rest of the app); edge-swipe or Back returns.
- Est. 1RM line with a **4 wk · 3 mo · 1 yr** segmented switch, phase starts marked (engine spec asks for this), drag across the chart to read a day's value.
- Under the chart: **Best set** and **Last time**.
- Bodyweight / assisted / band lifts: the builder picks a sensible measure (e.g. reps for band, effective load for bodyweight via `effectiveReps`/`predictE1rm`) and states it in the plan.

### Empty state
New account or < 3 sessions anywhere: one line, "Log a few sessions to see progress here", no empty charts. The muscle map's This week view still works from the first set.

## History tab

- **Month calendar** (Dylan chose it over a list), Su–Sa, opens on the current month with the latest workout selected.
- ‹ › to change month, and horizontal swipe on the grid with spring + velocity handoff (apple-design §5–6).
- Training days: tinted **and** a dot (color is never the only signal); today outlined; selected day solid accent.
- Tap a training day → summary row below the grid: date and muscles trained (primary muscles of its exercises, most sets first, up to 3), "· 6 exercises". Days without training aren't tappable.
- VoiceOver: each day reads "Thursday, October 16, workout" / "no workout".

### Workout screen (pushed view)
- Title = the date. Each exercise with its working sets ("185 × 8, 185 × 7"). Archived exercises still show normally. (Deleting an exercise already removes its blocks from every session via `deleteExerciseCascade`, and Settings warns about that cost, so History never meets a deleted exercise; that rule stays.)
- Tap an exercise → every set including warm-ups, difficulty and test-day mark.
- **Fix or remove past sets** the same way as the Log (tap to fix, swipe to remove, Undo toast) (**Dylan approved the guess**). Progress and volume update from the same store.
- **Repeat this workout** button at the bottom.

## Repeat this workout

- Queues that workout's exercises, in their original order, into today's Log and switches to the Log tab.
- Each queued exercise opens with **this week's target** from `targetsFor` (not the old numbers).
- **Next exercise** suggests the next queued exercise at the top of the picker; Dylan can still pick anything, skip, or add. Picking a queued exercise removes it from the queue; picking something else leaves the queue alone.
- If today already has logged exercises, queued ones go after them; nothing logged is replaced or reordered.
- Exercises that are now archived are skipped, with one toast line: "Skipped 1 archived exercise". (Deleted exercises can't appear: deletion removes them from past sessions.)
- The queue lives in the UI state (`overload.v2.ui`), not the backup. It needs **UI state v4** with an upgrade path from v3 (CLAUDE.md: never lose data — a v3 draft must survive the upgrade). The queue is cleared at the end of the log day.
- Note: Plan B listed "exercise suggestions" as a non-goal. Repeat is different — Dylan chose the workout — and he approved it on 2026-10-19.

## Cutover

Happens only after everything above is built, reviewed and checked.

1. The new UI becomes the entry at `/` (`index.html`); `/next.html` goes away; the old app's code (`src/App.jsx`, `src/storage.js`, `src/index.css` and anything only they use) is deleted.
   **App identity:** the manifest (`vite.config.js`: `theme_color`/`background_color` `#1C1B19`, description) and `index.html` (`theme-color`, mask-icon `#C4451F`) still carry the old brown/orange look; they switch to the Midnight/teal values `next.html` already uses (dark `#0e1118`, light `#f6f4ef`). **New icon (Dylan: "make it a higher quality, make it feel premium"):** a new Midnight/teal icon replaces `public/icon.svg` and every generated PNG (64, 192, 512, maskable 512, apple-touch 180, favicon). Premium means: one simple, confident mark that reads at 29 pt and 1024 px, no thin lines or text, subtle depth (gradient/lighting) rather than flat clip-art, and a maskable version with the mark inside the safe zone. Built as SVG and rendered to PNGs. **The builder shows Dylan 2–3 concepts as mockups (on a home-screen-style grid, light and dark wallpaper) and he picks before the PNGs are made.** The same 1024 px master later serves the App Store (Stage C). iPhone note for Dylan: a home-screen icon usually only updates after removing and re-adding the app (data is unaffected).
2. **Keep:** the old app's localStorage keys stay untouched on the device; "Download old app data" in Settings keeps working.
3. **Service worker:** after deploy, the phone must switch to the new app without getting stuck on the cached old one. The builder verifies the update path (e.g. the new SW takes over and the page reloads once, or the next open shows the new app) in a production preview, and states the expected behavior in the plan.
4. **Gate:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` green; a browser walk at 320×640 and 390×844, light and dark, reduced motion; a fresh code review of the Plan C diff.
5. **Merge `rewrite` → `main` only with Dylan's explicit yes** — the push deploys production (CLAUDE.md).
6. **Rollback:** Netlify rollback to the previous deploy restores the old app; data logged in the new app stays in `overload.v2` and reappears when rolled forward.
7. After deploy: update `HANDOFF.md`, `README.md` (replace the Vite boilerplate) and note the month of testing.

## Apple-design checklist (applies to every screen above)

- Press feedback on pointer-down; pushed views slide in from the right and swipe back the same way (spatial consistency).
- Springs are critically damped by default; bounce only after a flick (calendar month swipe).
- Chart scrubbing tracks the finger 1:1.
- Numbers use tabular figures; sizes in rem so Dynamic Type scales the layout.
- Reduced motion: slides become cross-fades; reduced transparency: solid surfaces.
- Every screen answers "where am I / how do I get back".

## Testing

- **Domain (unit):** muscle-map status per muscle (all five This-week states incl. Over; Strength states incl. No data and the ≥ 3-session rule); headline counting; lift ordering and change values; repeat queue building (order, skip archived/deleted, append after today's blocks); UI state v3 → v4 upgrade keeps the draft.
- **UI (component):** Progress empty state; muscle tap → panel text; calendar month change and day selection; workout screen edit/remove with Undo; Repeat → Log shows the first queued exercise with its target.
- **Contrast:** new legend tones in both themes through the existing contrast test.
- **Browser walk** before cutover as in the gate above.

## Left to the builder

- Exact SVG paths of the figure (must meet the identifiability and proportion bar above).
- Thresholds for Flat / Up a lot, and how window start/end est. 1RM is measured.
- Measures for bodyweight / assisted / band lifts on charts.
- Chart drawing approach (hand-rolled SVG vs a small library); if a dependency is added, check its source and size first.
- Component structure and file layout, following `src/features/*` conventions.
