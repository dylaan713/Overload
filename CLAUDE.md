# Overload

Workout-logging PWA (React 19 + Vite, data on-device in localStorage, no backend), live at https://overloadylan.netlify.app. **Read `HANDOFF.md` first.** Native-app stages are in `PUBLISHING.md`.

## Commands
`npm test` (vitest) · `npm run typecheck` · `npm run lint` (eslint) · `npm run build` · `npm run dev`

Baseline 2026-11-07: **603 tests / 61 files pass**, typecheck and lint clean, build green.

## Hard rules
- **Every push to `main` redeploys production** (GitHub-connected Netlify). Push only with Dylan's yes.
- ~~The rewrite lives on branch `rewrite` until its cutover plan says otherwise; don't merge it
  early.~~ **Spent: `rewrite` was merged into `main` and shipped** (`647e030`, verified an ancestor
  of `HEAD` on 2026-11-07). The branch still exists locally and on `origin`; work on `main`.
- Never lose user data: localStorage changes need a migration, and backup export/import must keep working.

## Definition of done
`npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass; show the output. For UI changes, check the app at phone width.

## Capability

Project-scoped Claude skills and why they were chosen: `.claude/CAPABILITY.md`.

## Audit context

Read by the global auditor agents (`correctness-auditor`, `ui-auditor`). Written 2026-11-07.
No project-scoped agents exist here.

### Read first

`HANDOFF.md` **first** — its Status block is current as of 2026-11-07; **everything below it is
dated history, newest first**, and several of those entries repeat a TEMP frame-readout task that
is already done · this file · `PUBLISHING.md` for the native-app stages.

### Commands

```bash
npm test            # vitest
npm run typecheck
npm run lint        # eslint
npm run build
```

Baseline 2026-11-07: **603 tests / 61 files pass**, typecheck clean, lint clean, build green.

### Hard rules

- **Every push to `main` redeploys production** (GitHub-connected Netlify). `main` is currently
  ahead of `origin` and unpushed; leave it that way.
- **Never lose user data.** All data is on-device in `localStorage`. A storage-shape change needs a
  migration, old files must still read, and **backup export/import must keep working**. This is
  the highest-severity category in this repo — a data-loss finding outranks anything else.
- The app is a phone-first PWA. **Desktop Chrome is not the target**; a performance claim measured
  on a Mac is not a claim about the phone.
- **A service worker serves this app.** If it ever looks laggy, check the service worker before the
  code — a stale cache serving an old bundle has already cost a whole debugging session. Confirm
  the served bundle hash matches `dist/`.

### Decided — don't re-flag

- The `rewrite` branch **is merged and shipped** (`647e030` is an ancestor of `HEAD`). The old
  "don't merge it early" rule is spent, not violated. The branch still exists locally and on
  `origin`; work on `main`.
- **The TEMP frame readout is out.** `src/app/frames.ts` does not exist. Five separate state
  updates ask for it to be screenshotted and removed — treat all of them as history.
- One spacing scale: `--s-1..--s-7` (2 4 8 12 16 24 32px) plus `--header-h` in `tokens.css`, **in
  rem** so spacing grows with the iOS text size. Two `tokens.test.ts` cases guard it: the scale is
  rem and ascending, and no raw px spacing in a module.
- `src/ui/Card.*` was deleted on purpose — it was imported only by its own test.
- Sheet motion is **one composited transform**. The 100vmax page shadow, the per-frame
  `border-radius` interpolation and the per-frame `--sheet-progress` write on `:root` were all
  removed deliberately; `sheetProgress` is a motion value now.
- Pull-down-to-close **must not `preventDefault` before its 10px slop decides the gesture is a
  drag** — iOS gives a touch sequence no click once a move has been prevented, which is what
  dropped taps inside sheets.

### Never touch

- `localStorage` key names or the stored UI-state version without a migration and a test that old
  files still read.
- The backup export/import format.

### Checklist — correctness

1. **Data safety first:** any `localStorage` shape change without a migration; any path where a
   reload, a conflict or a crash could drop a logged set; backup export/import round-tripping.
2. **UI state versioning:** `endWorkout` moved v4 → v5 and old files read as not ended. Check every
   version bump has that property.
3. **Clocks:** the Log's two clocks freeze on `endWorkout` and pick back up when another set is
   logged; the tick drops to once a minute when nothing is live and stops while the app is hidden.
4. **Block removal:** `removeBlock`/`restoreBlock` mirror the set pair — an emptied session goes
   and comes back with its id, and sets logged since are never split into two blocks.
5. **Double progression** targets, warm-up ramps, Est. 1RM, setbacks, stalls, time off, lighter
   weeks.
6. **Deferred items, known and not implicated:** `SwipeRow`'s `onClickCapture` eating a tap that
   drifts 10px sideways; the tab bar's unconditional blur; `viewport.ts`'s fixed probe doing a
   forced layout and an `--app-gap` write on every resize, i.e. every keypad open. Report movement
   on these, not their existence.

### Checklist — ui

1. **Phone widths 390 and 320** with no horizontal overflow, light and dark.
2. The one spacing scale — no raw px spacing in a CSS module.
3. **No per-frame writes to `documentElement`** and no `backdrop-filter` while the page behind is
   moving; `will-change` only on things that actually move.
4. Reduced motion: sheets square up, no spring.
5. iOS safe areas — the home-screen web view ends 47px short, handled by `--safe-bottom`.
6. Long values must wrap rather than crush a lift's name; the sparkline gives up its room under
   360px.
