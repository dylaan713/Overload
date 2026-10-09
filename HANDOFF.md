# Handoff
Last updated 2026-10-09.

## Status
Overload is a workout-logging PWA (React 19 + Vite 6, data kept on-device in localStorage, no backend). It has a Log / Stats / History nav, double-progression coaching, warm-up ramps, Est. 1RM charts, a rest timer and backup export/import. Stage A of `PUBLISHING.md` is done: the app is live at https://overloadylan.netlify.app/ and every push to `main` auto-deploys through Netlify. Native store builds (Stages B and C) have not started. The repo has a lint script but no tests, and `README.md` is still the Vite template boilerplate.

## Next
1. Stage B (`PUBLISHING.md`): wrap the app with Capacitor for native builds.
   - Choose the permanent bundle id (`com.YOURNAME.overload`).
   - Run the Capacitor setup and `npx cap add android`, then `npx cap add ios` (this Mac now covers the iOS step).
2. After the Capacitor wrap, add `@capacitor/local-notifications` and wire an at-zero alert into `RestTimer` in `src/App.jsx`. The web sound and vibration alerts were removed because they don't fire in a backgrounded iOS PWA.
3. Stage C: store accounts, assets (1024 px icon, screenshots, descriptions), a hosted privacy-policy page, then Play internal testing and TestFlight.
4. Replace the boilerplate `README.md` with a real project description.
5. Question for Dylan: `PUBLISHING.md` assumes a Windows PC with a Mac on the side. Should it be updated now that development is on this Mac?
6. Question for Dylan: are you ready to start Stage B, or should the app stay a PWA for now? The repo doesn't say.

## Blockers
- Dylan: decide when to start Stage B and pick the bundle id.
- Dylan: Stage C needs paid accounts (Google Play $25 one-time, Apple Developer $99/yr).

## Last session
2026-07-21: Added a rest timer (1, 2 and 3 min presets plus a custom default), rep-aware double-progression coaching with a stall/deload path, an Est. 1RM chart toggle, and a merged 3-tab nav (Log / Stats / History). Then removed the timer's sound and vibration alerts because they were silent on iPhone, and documented a native local notification as the Capacitor follow-up in `PUBLISHING.md`.
