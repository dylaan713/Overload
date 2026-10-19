# Overload

A workout-logging app that tells you when to add weight. Log every set with how hard it felt; Overload sets each lift's next target (double progression, step-aware, with setbacks, stalls, time off and lighter weeks handled), shows which muscles are short of their weekly sets, and tracks whether you're getting stronger.

Live: https://overloadylan.netlify.app (installable PWA). Data stays on the device (localStorage); back it up from Settings.

## Tabs
- **Log** — today's workout, one exercise at a time: target beside last time, Easy / Moderate / Hard / All out, warm-ups, test days.
- **Progress** — *Lifts*: "Stronger on n of m lifts" over 8 weeks, what needs attention and why, every lift with its trend and chart. *Muscles*: a front/back map of this week's sets or 8-week strength change.
- **History** — a month calendar; open a day to fix or remove sets, or **Repeat this workout** into today's Log.

## Develop
React 19 + TypeScript + Vite 6, zustand, motion. No backend.

```bash
npm install
npm run dev        # local app
npm test           # vitest
npm run typecheck
npm run lint
npm run build      # production build + service worker
```

Every push to `main` deploys production (Netlify). Native builds (Capacitor) are planned in `PUBLISHING.md`; project state lives in `HANDOFF.md`.
