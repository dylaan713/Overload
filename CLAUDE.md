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
