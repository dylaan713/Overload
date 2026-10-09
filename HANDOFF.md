# Handoff
Last updated 2026-10-09 (rewrite branch).

## Status
Overload is a workout-logging PWA (React 19 + Vite 6, data kept on-device in localStorage, no backend). It has a Log / Stats / History nav, double-progression coaching, warm-up ramps, Est. 1RM charts, a rest timer and backup export/import. Stage A of `PUBLISHING.md` is done: the app is live on Netlify and every push to `main` auto-deploys through Netlify. Native store builds (Stages B and C) have not started. The repo has a lint script but no tests, and `README.md` is still the Vite template boilerplate.

## Next
State Update 2026-10-09: Foundation done on branch `rewrite` (TS + Vitest, v2 store, lossless legacy migration, v1/v2 backups, ported engine with golden tests against real data, read-only /dev.html dry run). `App.jsx` is still the shipping UI.
Next: after merging `rewrite` to `main`, open /dev.html on the phone to confirm counts (expect 41 exercises, 57 sessions); then spec sub-project 2 (design system + shell, real persisting migration on first launch) and a separate spec for the engine redesign (smarter progression, RPE, deloads).

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
