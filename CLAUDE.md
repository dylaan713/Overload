# Overload

Workout-logging PWA (React 19 + Vite, data on-device in localStorage, no backend), live at https://overloadylan.netlify.app. **Read `HANDOFF.md` first.** Native-app stages are in `PUBLISHING.md`.

## Commands
`npm test` (vitest) · `npm run typecheck` · `npm run lint` (eslint) · `npm run build` · `npm run dev`

## Hard rules
- **Every push to `main` redeploys production** (GitHub-connected Netlify). Push only with Dylan's yes.
- The rewrite lives on branch `rewrite` until its cutover plan says otherwise; don't merge it early.
- Never lose user data: localStorage changes need a migration, and backup export/import must keep working.

## Definition of done
`npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass; show the output. For UI changes, check the app at phone width.
