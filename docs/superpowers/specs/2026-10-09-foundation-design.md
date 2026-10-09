# Overload rewrite — Sub-project 1: Foundation

Date: 2026-10-09 · Branch: `rewrite` · Status: draft for review

## Context and intent
Overload is a local-first workout-logging PWA (React 19 + Vite 6, ~2,150 lines in one `src/App.jsx`, no tests). The owner (Dylan) is the only user today; the app should be built for him now and be store-ready later. Goal of the whole rewrite: a higher-end app with polish/feel and smarter training. The one hard constraint: **all data currently on the owner's phone must carry over unchanged.**

Whole rewrite is split into six sub-projects, each with its own spec/plan:
1. **Foundation (this spec)** — TS project, data layer, legacy migration, pure training engine, tests.
2. Design system and shell. 3. Active workout mode + gestures/animation. 4. Programs/templates. 5. Intelligence (RPE, PRs, volume/recovery). 6. Native Capacitor wrap (real haptics, rest-timer notification, data transfer from web origin).

Assumptions: local-first, no accounts or sync; same Netlify site/origin so localStorage is preserved; native work is sub-project 6.

## Current data (verified from real backups, 2026-10-09)
localStorage keys, each a JSON string:
- `exercises`: `{id, name, type: "compound"|"isolation", muscleGroup}`
- `sessions`: `{id, date: "YYYY-MM-DD", name, blocks: [{id, exerciseId, sets: [{weight:number, reps:number, warmup:boolean}]}]}`
- `customGroups`: string[]
- `settings`: `{unit, increment, compound{sets,repBottom,repTop,warmupSets}, isolation{...}, restTimer{defaultSeconds}, theme}`

Backup file v1: `{app:"overload", version:1, exportedAt, exercises, sessions, customGroups, settings}`.
Real fixtures: 41 exercises / 57 sessions (2026-07-18..2026-10-08), plus an older 29/30 backup (Aug).

## Scope
In: TypeScript/Vitest setup, schema + types, storage adapter, v2 store, legacy migration, v1/v2 backup import/export, pure training engine (ported), golden + unit tests, minimal shell proving load/migrate.
Out: any new UI/visual work, new features (RPE UI, programs, PRs), native wrap. Existing `App.jsx` remains the shipping UI until sub-project 2.

## Design

### Data layer (`src/data`)
- **Types** in `src/domain/types.ts`: `Exercise`, `SetEntry` (with optional `rpe?: number`), `Block`, `Session`, `Settings`, `Program` (empty reserved array), `StoreDoc { schemaVersion: 2; exercises; sessions; customGroups; settings; programs }`.
- **Storage adapter**: `KeyValueStore { get(key): Promise<string|null>; set(key, value): Promise<void> }`, with a localStorage implementation. A Capacitor Preferences implementation can be added in sub-project 6. Read errors are surfaced, not swallowed (the old wrapper logs and returns null, which can hide data loss).
- **v2 store**: a single document under key `overload.v2`, written whole and atomically (one `set`).
- **Boot sequence**: if `overload.v2` exists → parse, validate, use it, ignore legacy keys. Else if any legacy key exists → migrate. Else → fresh empty doc.
- **Migration** (`migrateLegacy`): read `exercises`, `sessions`, `customGroups`, `settings`; normalize; validate; write `overload.v2`. **Legacy keys are never modified or deleted**, so they act as an untouched backup and a Netlify rollback to the old app still sees all data (data logged only in v2 does not appear in the old app).
- **Normalization is tolerant**: numeric strings → numbers, missing `warmup` → `false`, missing settings merged over defaults (same behavior as today's `mergeSettings`), unknown fields preserved, nothing dropped. Referential check: every `block.exerciseId` must exist in `exercises`; orphans are reported, not deleted.
- **Failure behavior**: if parse or validation fails, write nothing, show an error screen offering raw export of the legacy keys. Never overwrite.
- **Backups**: export writes v2 (`{app:"overload", version:2, ...}`); import accepts v1 and v2 (v1 reader is permanent). Import validates before replacing anything and takes effect only if the whole file is valid.

### Training engine (`src/domain`)
Pure functions, no React/storage/DOM: progression suggestion (including stall/deload constants `STALL_SESSIONS=3`, `BLOWOUT_MARGIN=3`, `DELOAD_PCT=0.9`), target weight, warm-up ramps, Est. 1RM, entries-by-exercise grouping, plate rounding. Ported from `App.jsx` with behavior preserved exactly.

### Project setup
- Work on branch `rewrite`; `main` stays deployable (auto-deploys to Netlify).
- Add TypeScript (strict), Vitest; keep Vite, React 19, ESLint, vite-plugin-pwa, Netlify config.
- Layout: `src/domain/` (types + engine), `src/data/` (adapter, store, migration, backup), `src/app/` (later UI). Legacy `src/App.jsx` stays the entry until sub-project 2; a minimal dev shell exercises the data layer.
- `fixtures/` is gitignored (personal data).

## Testing
- **Golden tests**: run the *current* `App.jsx` logic over the real fixture, record outputs (suggestions per exercise per session, warm-ups, e1RM); the ported engine must reproduce them exactly. Old logic is extracted into a test-only reference module so outputs are generated, not hand-written.
- **Migration tests**: Oct and Aug fixtures migrate losslessly (counts, ids, every set equal); legacy keys byte-identical after migration; re-running boot is idempotent; corrupt/partial legacy input fails without writing.
- **Backup tests**: v1 import → v2 export → import round-trip is lossless.
- **Engine unit tests**: empty history, kg vs lb, warm-up-only entries, stall → deload, blowout jump.
- Gate for every micro-task: tests, `tsc --noEmit`, lint pass.

## Risks
- Golden fixtures are personal data and live only locally; CI has none. Mitigation: also commit a small synthetic fixture that exercises the same paths.
- iOS may evict localStorage under storage pressure; mitigated by prominent export and (sub-project 6) native storage.
- Origin change in the native wrap breaks localStorage continuity; handled by the export/import path in sub-project 6.

## Success criteria
1. Loading the new build with the real legacy data yields identical exercises/sessions/settings in `overload.v2`, with legacy keys untouched.
2. Ported engine matches old outputs on every fixture session.
3. Old v1 backups still import; v2 export round-trips.
4. Tests, typecheck and lint pass; `main` and the live app are unaffected until merge.
