# Overload

A workout-logging app that tells you when to add weight. Log every set with how hard it felt; Overload sets each lift's next target (double progression, step-aware, with setbacks, stalls, time off and lighter weeks handled), shows which muscles are short of their weekly sets, and tracks whether you're getting stronger.

Live: https://overloadylan.netlify.app (installable PWA). Data stays on the device (localStorage); back it up from Settings.

Its targets are general training guidance, not medical advice.

## Tabs
- **Log** — today's workout, one exercise at a time: target beside last time, Easy / Moderate / Hard / All out, warm-ups, test days.
- **Progress** — *Lifts*: "Stronger on n of m lifts" over 8 weeks, what needs attention and why, every lift with its trend and chart. *Muscles*: a front/back map of this week's sets or 8-week strength change.
- **History** — a month calendar; open a day to fix or remove sets, or **Repeat this workout** into today's Log.

## How this was built
This is my project, built by directing AI coding agents. I decided what the app should do, wrote
the requirements with the agent as five design specs, and set the tests that decide whether each
feature is right. Claude Code wrote the code and the tests from those specs and the plans that
follow them. Every commit that an agent wrote says so in its co-author line.

- [`docs/superpowers/specs/`](docs/superpowers/specs/): the five specs (foundation, design system
  and shell, training engine, log, progress and history).
- [`docs/superpowers/plans/`](docs/superpowers/plans/): the plan each spec was built from.
- `src/domain/`: the training engine, kept separate from the screens so it can be tested on its own.
- 603 tests across 61 files (`npm test`), plus type check and lint, pass before anything ships.

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

## License
No license is granted. The code is published to be read; all rights are reserved.
