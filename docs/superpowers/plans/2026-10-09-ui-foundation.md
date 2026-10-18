# UI Foundation (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a whole new, native-feeling UI foundation on the new training-engine data model. It covers design tokens, primitives, a spring-driven motion layer (draggable sheets, a navigation stack inside them, sliding segmented controls, undo toasts), the app store, the shell (Log · Progress · History), the Settings sheet and the Exercise library. It is served at `/next.html` while the old app keeps shipping.

> **Revision 2026-10-17b (training engine + Apple-design interaction).** This revision replaces the 2026-10-09 draft and its first revision.
> - **Data model:** the app starts empty, so there is no migration banner. Exercises come from the library or are created by the user, so muscle groups, custom groups and the type badge are gone. Settings becomes Units (converting) · Training style · Equipment steps · Appearance · Exercise library · Data & backup.
> - **Interaction:** springs (`motion@13.5.1`), drag-to-dismiss sheets, an in-sheet navigation stack, a sliding segmented thumb, translucent chrome with scroll-edge fades, and Archive + Undo instead of delete.
> - **Tabs:** Log · Progress · History.
> - **Tasks:** 1–3 keep their 2026-10-09 text except where marked. Segmented and Sheet move out of Task 3 into the new Task 4 (motion foundation). Tasks 5–10 are new.

**Architecture:** React 19 + TypeScript. CSS variables (tokens) with CSS Modules; `motion` springs for anything that moves under the finger; Zustand vanilla stores injected with a `KeyValueStore`, so every test runs on an in-memory store. Screens read and write only through store actions, which persist the whole `overload.v2` document and roll back on failure. The domain (`src/domain`, engine and library) is already built. Plan A adds only the small helpers in Task 5. `src/App.jsx` and `index.html` (the live app) are untouched.

**Tech Stack:** React 19, TypeScript strict, Vite 6, Zustand, `motion@13.5.1` (MIT; `motion/react`), CSS Modules, system font + JetBrains Mono, lucide-react, Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-09-design-system-and-shell-design.md`. Its first section (Revision 2026-10-17b) wins over the older text below it. Also `docs/superpowers/specs/2026-10-17-training-engine-design.md` ("Impact on the other plans → Plan A"). Interaction principles come from the `apple-design` skill. Plan A is 1 of 3: A = foundation, Settings and library; B = Log + coaching + rest timer + UI-state persistence; C = Progress + History + e2e + cutover.

## Global Constraints

- **Colors:**
  - Dark tokens: bg `#0e1118`, surface `#161a24`, surface2 `#1d2230`, line `#222836`, text `#e9edf5`, accent `#3fd0c9`, on-accent `#04191a`.
  - Light tokens: bg `#f6f4ef`, surface `#ffffff`, line `#e4e0d6`, text `#15181f`.
  - The contrast test is authoritative for the remaining values. When it rejects a value, change the value, never the threshold, and say so in the commit.
- **Contrast and type size:** 4.5:1 for body/small text, 3:1 for large numerals (≥24px, or ≥19px bold). No `font-size` below 13px (0.8125rem) in any CSS under `src/`. Inputs are never under 16px (`max(16px, var(--text-base))`).
- **Font sizes** in CSS Modules use the `--text-*` tokens (rem), never raw px.
- **Tap targets** are ≥44px tall for buttons, inputs, tabs, segmented options, chips and list rows.
- **Response:**
  - Every pressable control shows its pressed state on touch-down (`:active`, ≤100ms, `--dur-press`).
  - Hover styles live only inside `@media (hover: hover)`.
  - No debounce or artificial delay on any input path (search filters on every keystroke).
- **Motion:**
  - Anything that moves in response to touch, or that the user can interrupt, uses `motion` springs from `src/ui/motion.ts`. Default is critically damped (`bounce: 0`); `bounce: 0.2` only after a release with momentum.
  - CSS transitions only for press states, color and opacity.
  - Animations start from the current on-screen value, keep input live, and hand release velocity to the spring.
- **Spatial consistency:** sheets enter from the bottom and leave downward. Pushed views enter from the right and pop back to the right. Toasts enter and leave at the bottom.
- **Reduced motion and accessibility:**
  - Under `prefers-reduced-motion: reduce`, movement becomes a cross-fade: `<MotionConfig reducedMotion="user">` plus `--motion-offset: 0`. Never a hard cut, and no overshoot.
  - `prefers-reduced-transparency` makes chrome solid. `prefers-contrast: more` strengthens edges.
- **Materials:** the header and tab bar are translucent (`--material` + `backdrop-filter`) only while content scrolls under them, with a soft fade edge instead of a hairline. Never put a translucent surface on another translucent surface.
- **Agency:**
  - Prefer Undo to confirmation. Confirm only irreversible actions: permanent delete, import replace, unit conversion.
  - Validate inline (on blur/Enter), with a message under the field. Never fail silently.
- **Wayfinding:** tabs are exactly **Log**, **Progress**, **History**. Settings is a sheet opened by the header's gear, with Done. Nested views show Back labelled with the parent's title.
- **App Store target:** the UI reads as a native iOS app. Platform calls that differ between browser and native (file download, storage, later haptics and notifications) go through one small module each.
- **Type:** the platform system font with `font-variant-numeric: tabular-nums` on numerals, and JetBrains Mono for set logs and the timer.
- **Theme:** the preference is `settings.theme` ∈ `"system" | "dark" | "light"` (validation already maps anything else to `system`).
- **Data:**
  - The new app starts empty. Legacy keys `exercises`, `sessions`, `customGroups`, `settings` are never written or deleted.
  - `overload.v2` is written only through `saveDoc` (whole document, one write). Transient UI state uses `overload.v2.ui`.
  - Weights are shown in `settings.unit`. Suggested weights come only from the engine.
- **Do not modify:** `src/App.jsx`, `index.html`, `src/storage.js`, `src/index.css`, or the engine rules in `src/domain/engine/`.
- **Gate:** `npm test && npm run typecheck && npm run lint` must pass before every commit. UI tasks are also checked at 390×844 in both themes during Task 10.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (as the second `-m`). Work on branch `rewrite`.

## Review Focus

1. **Grabbing a sheet mid-animation** (dragging it while it closes, or pressing Done during a drag) must follow the finger from where it is. It must close exactly once and never leave the page scaled back or `inert` after it's gone (Task 4).
2. **Switching units** must show the exact number of sets it converts. Cancel changes nothing. A failed save restores both the unit and every weight (Tasks 6, 8).
3. **Changing training style twice on the same day** must not create zero-length phases. A phase start date can't be in the future or before the previous phase (Task 5).
4. **Adding a library exercise that's already in My exercises** must not create a duplicate. If it's archived, it's restored with its history (Tasks 6, 9).
5. **Undo after a failed save:** an archive whose save fails rolls back and shows the save error, not an Undo toast for something that never happened (Tasks 6, 9).

## File Structure

```
next.html                         temporary entry for the new UI (cutover is Plan C)
src/next/main.tsx                 renders <App kv={localStorage KV}/>
src/styles/{tokens,a11y,base}.css design tokens (color, type, motion, material), a11y overrides, base styles
src/domain/theme.ts               themePreference() (ThemePref lives in domain/types)
src/domain/exercises.ts           region grouping, library state, cascade delete, usage count
src/domain/settings.ts            (+ startPhase, setPhaseStart)
src/domain/library/index.ts       (+ exerciseError, equipmentLabel, groupByMovement)
src/ui/motion.ts                  SPRING presets, MotionRoot
src/ui/gesture.ts                 project, rubberband, commitOnRelease (pure, tested)
src/ui/*.tsx + *.module.css       Button, IconButton, Card, Field/Input/Select, NumberField, Pill, ChipGroup,
                                  EmptyState, Segmented, Sheet, SheetStack, Toast, ListRow
src/state/{appStore,uiStore}.ts   doc + actions + persistence/rollback; tab, sheet, toast
src/state/context.tsx             StoreProvider, useApp, useUi, useKv
src/app/App.tsx, Shell.tsx        boot, theme apply, chrome, tab routing, sheet + toast hosts
src/app/{Header,TabBar,ErrorScreen,ErrorBoundary,Banner}.tsx
src/app/{theme,download,readFile}.ts
src/features/settings/*           SettingsRoot, StyleRulesView, EquipmentStepsView
src/features/exercises/*          LibraryView, ExerciseDetailView, AddExerciseView, ChooseEquipmentView, CreateExerciseView
src/features/placeholders.tsx     temporary Log/Progress/History placeholders
tests/setup.ts, tests/helpers/{contrast,blob,seed,renderWithStore}.ts(x), tests/helpers/build.ts (exists)
tests/{ui,state,app,features,styles,domain}/*.test.ts(x)
```

---

### Task 1: UI toolchain and `/next.html` entry

**Files:**
- Modify: `package.json`, `tsconfig.json`, `vite.config.js`, `eslint.config.js`
- Create: `tests/setup.ts`, `tests/ui/toolchain.test.tsx`, `next.html`, `src/next/main.tsx`, `src/app/App.tsx` (stub), `src/styles/base.css` (stub, filled in Task 2)

**Interfaces:**
- Produces: working `.tsx` + CSS-Modules + jsdom test toolchain; `App` stub `export function App(props: { kv: KeyValueStore })` replaced in Task 6.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install zustand
npm install -D @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 jsdom@^26
```
Expected: installs cleanly.

- [ ] **Step 2: Write the failing toolchain test `tests/ui/toolchain.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("toolchain", () => {
  it("renders TSX in jsdom with jest-dom matchers", () => {
    render(<h1>Overload</h1>);
    expect(screen.getByRole("heading", { name: "Overload" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run tests/ui/toolchain.test.tsx`
Expected: FAIL (no tsx include / no jsdom env / `toBeInTheDocument` undefined).

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

- [ ] **Step 5: Update `vite.config.js`**

Replace the existing `test` block with:
```js
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
```
Add the third build entry next to `dev`:
```js
        next: fileURLToPath(new URL('./next.html', import.meta.url)),
```
and change the service-worker denylist to:
```js
        navigateFallbackDenylist: [/dev\.html$/, /next\.html$/],
```

- [ ] **Step 6: Update `tsconfig.json`**

Set `"types": ["node", "vite/client"]`, add `"jsx": "react-jsx"` to `compilerOptions`, and set `include` to:
```json
["src/domain", "src/data", "src/dev", "src/ui", "src/state", "src/app", "src/features", "src/next", "tests"]
```

- [ ] **Step 7: Update `eslint.config.js`**

Change the two `files: ['**/*.ts']` entries to `files: ['**/*.{ts,tsx}']` (both the tseslint map and the globals block), and append:
```js
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
```

- [ ] **Step 8: Create the entry files**

`src/styles/base.css` (stub): `/* filled in Task 2 */`

`src/app/App.tsx`:
```tsx
import type { KeyValueStore } from "../data/kv";

export function App({ kv }: { kv: KeyValueStore }) {
  return <main data-storage-ready={String(Boolean(kv))}>Overload (next)</main>;
}
```

`src/next/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "../styles/base.css";
import { createLocalStorageKV } from "../data/kv";
import { App } from "../app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App kv={createLocalStorageKV()} />
  </StrictMode>,
);
```

`next.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0e1118" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f4ef" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Overload" />
    <title>Overload</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/next/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Run the gate and the build**

Run: `npm test && npm run typecheck && npm run lint && npm run build && ls dist/next.html`
Expected: all prior tests plus the toolchain test pass (63 total); typecheck/lint clean; build succeeds; `dist/next.html` exists and `dist/index.html` is unchanged in behavior.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "build: add React/jsdom test toolchain and /next.html entry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Design tokens, base styles, theme preference and the contrast gate

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/a11y.css`, `src/domain/theme.ts`, `src/app/theme.ts`, `tests/helpers/contrast.ts`, `tests/styles/tokens.test.ts`, `tests/domain/theme.test.ts`, `tests/app/theme.test.ts`
- Modify: `src/styles/base.css`, `src/next/main.tsx` (import tokens)

**Interfaces:**
- Produces: CSS variables `--bg --surface --surface2 --line --text --muted --accent --on-accent --warn --danger --on-danger` (+ `--accent-soft --warn-soft --danger-soft`, `--font-body --font-mono --radius --radius-sm`); type scale `--text-xs` (13) `--text-sm` (14) `--text-md` (15) `--text-base` (16) `--text-lg` (17) `--text-xl` (22) `--text-2xl` (28) `--text-3xl` (40) `--text-4xl` (64), in rem, with `--leading-tight --leading-snug` and `--tracking-tight --tracking-tighter`; motion `--dur-press --dur-fast --dur-sheet --ease-out --motion-offset`; material `--material --material-blur --scrim`; layout `--tabbar-h`; `ThemePref` (re-exported from `src/domain/types.ts`, where the engine plan defined it); `themePreference(stored: string | undefined): ThemePref`; `applyTheme(pref: ThemePref, root?: HTMLElement): void`; `contrast(hexA: string, hexB: string): number`.

Why rem: on iOS `html { font: -apple-system-body }` sets the root size from the user's text-size setting (17px at the default), so `rem` tokens scale with Dynamic Type in Safari and in the later WKWebView wrap. Browsers without that keyword keep the 16px root.

- [ ] **Step 1: Write failing tests**

`tests/helpers/contrast.ts`:
```ts
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
```

`tests/styles/tokens.test.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { contrast } from "../helpers/contrast";

const css = readFileSync("src/styles/tokens.css", "utf8");

function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
}

const lightStart = css.indexOf(':root[data-theme="light"]');
const mediaStart = css.indexOf("@media");
const dark = vars(css.slice(css.indexOf(":root {"), lightStart));
const light = vars(css.slice(lightStart, mediaStart));
const lightMedia = vars(css.slice(mediaStart));

const BACKGROUNDS = ["bg", "surface", "surface2"] as const;
const TEXT_ON_BG = ["text", "muted", "accent", "warn", "danger"] as const;

describe.each([
  ["dark", dark],
  ["light", light],
] as const)("%s theme contrast", (_name, t) => {
  for (const bgKey of BACKGROUNDS) {
    for (const fgKey of TEXT_ON_BG) {
      it(`${fgKey} on ${bgKey} is at least 4.5:1`, () => {
        expect(contrast(t[fgKey]!, t[bgKey]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("on-accent text on accent is at least 4.5:1", () => {
    expect(contrast(t["on-accent"]!, t["accent"]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("on-danger text on danger is at least 4.5:1", () => {
    expect(contrast(t["on-danger"]!, t["danger"]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("large numerals (text on bg) are at least 3:1", () => {
    expect(contrast(t["text"]!, t["bg"]!)).toBeGreaterThanOrEqual(3);
  });
});

describe("tokens file consistency", () => {
  it("the prefers-color-scheme: light block repeats the explicit light values exactly", () => {
    expect(lightMedia).toEqual(light);
  });
});

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : [],
  );
}

// Sizes in px, rem (at the 16px web root) or as --text-* token definitions; anything under 13px fails.
const SIZE = /(?:font(?:-size)?|--text-[\w-]+):\s*(?:[\w-]+\s+)*?(\d*\.?\d+)(px|rem)/g;

describe("typography floor", () => {
  it("no CSS under src/ sets a font-size or type token below 13px", () => {
    const offenders: string[] = [];
    for (const file of cssFiles("src")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(SIZE)) {
        const px = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
        if (px < 13) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("CSS Modules use type tokens, not raw font sizes", () => {
    const raw = cssFiles("src")
      .filter((f) => f.endsWith(".module.css"))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/font-size:\s*(\d[^;]*)/g)].map((m) => `${f}: ${m[1]}`));
    expect(raw).toEqual([]);
  });
});

describe("accessibility overrides (a11y.css)", () => {
  const a11y = readFileSync("src/styles/a11y.css", "utf8");

  it("handles reduced motion, reduced transparency and more contrast", () => {
    expect(a11y).toContain("prefers-reduced-motion: reduce");
    expect(a11y).toContain("prefers-reduced-transparency: reduce");
    expect(a11y).toContain("prefers-contrast: more");
  });

  it("more-contrast muted text reaches 7:1 on every background in both themes", () => {
    // Order in the file: dark block, explicit light block, system-light block.
    const muted = [...a11y.matchAll(/--muted:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1]!);
    expect(muted).toHaveLength(3);
    expect(muted[1]).toBe(muted[2]);
    for (const bg of BACKGROUNDS) {
      expect(contrast(muted[0]!, dark[bg]!)).toBeGreaterThanOrEqual(7);
      expect(contrast(muted[1]!, light[bg]!)).toBeGreaterThanOrEqual(7);
    }
  });
});
```

`tests/domain/theme.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { themePreference } from "../../src/domain/theme";

describe("themePreference", () => {
  it("passes through the three valid preferences", () => {
    expect(themePreference("system")).toBe("system");
    expect(themePreference("dark")).toBe("dark");
    expect(themePreference("light")).toBe("light");
  });
  it("maps legacy, unknown and missing values to system", () => {
    for (const v of ["ember", "slate", "violet", "paper", "", "DARK", undefined]) {
      expect(themePreference(v)).toBe("system");
    }
  });
});
```

`tests/app/theme.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { applyTheme } from "../../src/app/theme";

describe("applyTheme", () => {
  it("sets data-theme for dark/light and removes it for system", () => {
    const root = document.createElement("html");
    applyTheme("dark", root);
    expect(root.getAttribute("data-theme")).toBe("dark");
    applyTheme("light", root);
    expect(root.getAttribute("data-theme")).toBe("light");
    applyTheme("system", root);
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/styles tests/domain/theme.test.ts tests/app/theme.test.ts`
Expected: FAIL — `tokens.css` missing, theme modules missing.

- [ ] **Step 3: Create `src/styles/tokens.css`**

```css
/* Design tokens. Dark ("Midnight") is the default; light follows the system or an explicit override. */
:root {
  color-scheme: dark;
  --bg: #0e1118;
  --surface: #161a24;
  --surface2: #1d2230;
  --line: #222836;
  --text: #e9edf5;
  --muted: #8b95a9;
  --accent: #3fd0c9;
  --on-accent: #04191a;
  --warn: #e9b44c;
  --danger: #ff7a7a;
  --on-danger: #1a0505;
  --accent-soft: rgba(63, 208, 201, 0.14);
  --warn-soft: rgba(233, 180, 76, 0.14);
  --danger-soft: rgba(255, 122, 122, 0.14);
  --font-body: -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius: 16px;
  --radius-sm: 12px;

  /* Type scale (rem follows the iOS text-size setting; 13px floor, see the typography test). */
  --text-xs: 0.8125rem;
  --text-sm: 0.875rem;
  --text-md: 0.9375rem;
  --text-base: 1rem;
  --text-lg: 1.0625rem;
  --text-xl: 1.375rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.5rem;
  --text-4xl: 4rem;
  --leading-tight: 1.05; /* 40px+ numerals and the timer */
  --leading-snug: 1.2; /* 22-28px titles */
  --tracking-tight: -0.02em; /* 22-28px */
  --tracking-tighter: -0.03em; /* 40px+ */

  /* Motion. Springs and gestures arrive in the active-workout sub-project; these keep CSS motion consistent until then. */
  --dur-press: 90ms;
  --dur-fast: 180ms;
  --dur-sheet: 320ms;
  --ease-out: cubic-bezier(0.2, 0.9, 0.3, 1);
  --motion-offset: 1; /* multiplier for travel distance; 0 under reduced motion turns slides into fades */

  /* Materials: translucent chrome that content scrolls under. */
  --material: rgba(22, 26, 36, 0.72);
  --material-blur: saturate(180%) blur(20px);
  --scrim: rgba(4, 6, 10, 0.5);

  --tabbar-h: 56px;
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f6f4ef;
  --surface: #ffffff;
  --surface2: #eeebe3;
  --line: #e4e0d6;
  --text: #15181f;
  --muted: #5f6675;
  --accent: #086b66;
  --on-accent: #ffffff;
  --warn: #8a5a00;
  --danger: #b3261e;
  --on-danger: #ffffff;
  --accent-soft: rgba(8, 107, 102, 0.12);
  --warn-soft: rgba(138, 90, 0, 0.12);
  --danger-soft: rgba(179, 38, 30, 0.1);
  --material: rgba(255, 255, 255, 0.72);
  --scrim: rgba(21, 24, 31, 0.32);
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    --bg: #f6f4ef;
    --surface: #ffffff;
    --surface2: #eeebe3;
    --line: #e4e0d6;
    --text: #15181f;
    --muted: #5f6675;
    --accent: #086b66;
    --on-accent: #ffffff;
    --warn: #8a5a00;
    --danger: #b3261e;
    --on-danger: #ffffff;
    --accent-soft: rgba(8, 107, 102, 0.12);
    --warn-soft: rgba(138, 90, 0, 0.12);
    --danger-soft: rgba(179, 38, 30, 0.1);
    --material: rgba(255, 255, 255, 0.72);
    --scrim: rgba(21, 24, 31, 0.32);
  }
}
```

- [ ] **Step 4: Create `src/styles/a11y.css` and `src/styles/base.css`**

`src/styles/a11y.css` (system accessibility settings; keep the `--muted` order dark → explicit light → system light, the test relies on it):
```css
/* Reduced motion: keep feedback, drop travel. Slides become short cross-fades. */
@media (prefers-reduced-motion: reduce) {
  :root { --motion-offset: 0; --dur-sheet: 200ms; }
}

/* Reduced transparency: solid chrome, no blur. */
@media (prefers-reduced-transparency: reduce) {
  :root { --material: var(--surface); --material-blur: none; }
}

/* More contrast: stronger hairlines and secondary text. */
@media (prefers-contrast: more) {
  :root { --line: #4a5368; --muted: #b8c0cf; }
  :root[data-theme="light"] { --line: #9a9384; --muted: #424956; }
}
@media (prefers-contrast: more) and (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { --line: #9a9384; --muted: #424956; }
}
```

`src/styles/base.css`:
```css
@import "./tokens.css";
@import "./a11y.css";

*, *::before, *::after { box-sizing: border-box; }

/* iOS: root size follows the user's text-size setting. Elsewhere the 100% fallback keeps 16px. */
html { font-size: 100%; }
@supports (font: -apple-system-body) {
  html { font: -apple-system-body; }
}

html, body { margin: 0; background: var(--bg); color: var(--text); }

body {
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}

button, input, select, textarea { font: inherit; color: inherit; }

/* Touch: no grey tap flash, no double-tap-zoom delay; pressed states come from :active. */
button, a, label, input, select, textarea, [role="tab"], [role="radio"] {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

h1, h2, h3, p { margin: 0; }

.mono { font-family: var(--font-mono); }
```
Then remove the `import "../styles/tokens.css"` need: `base.css` already imports tokens, so `src/next/main.tsx` needs no change.

- [ ] **Step 5: Create `src/domain/theme.ts` and `src/app/theme.ts`**

`src/domain/theme.ts`:
```ts
import type { ThemePref } from "./types";
export type { ThemePref };

/** Legacy ("ember", "slate", ...), unknown or missing values all mean "system". */
export function themePreference(stored: string | undefined): ThemePref {
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
}
```

`src/app/theme.ts`:
```ts
import type { ThemePref } from "../domain/theme";

export function applyTheme(pref: ThemePref, root: HTMLElement = document.documentElement): void {
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}
```

- [ ] **Step 6: Run the tests; fix values, never thresholds**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. If a contrast assertion fails, change that token value in **both** the explicit light block and the media block (the consistency test enforces equality), re-run, and note the changed value in the commit message. The same rule applies to the more-contrast values in `a11y.css`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ui): add design tokens, theme preference and contrast gate" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Static UI primitives

> Revised 2026-10-17b: `Segmented` and `Sheet` move to Task 4, where they become spring-driven. `TypeBadge` is replaced by `Pill`, because the type badge is gone. `ChipGroup` is new (muscle pickers). `NumberField` gains `integer`, `optional`, `suffix` and `placeholder`.

**Files:**
- Create: `src/ui/Button.tsx`, `Button.module.css`, `IconButton.tsx`, `IconButton.module.css`, `Card.tsx`, `Card.module.css`, `Field.tsx`, `Field.module.css`, `NumberField.tsx`, `Pill.tsx`, `Pill.module.css`, `ChipGroup.tsx`, `ChipGroup.module.css`, `EmptyState.tsx`, `EmptyState.module.css`
- Test: `tests/ui/Button.test.tsx`, `tests/ui/NumberField.test.tsx`, `tests/ui/primitives.test.tsx`, `tests/ui/ChipGroup.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant?: "primary"|"secondary"|"ghost"|"danger"; block?: boolean } & ButtonHTMLAttributes)`
  - `IconButton({ label: string; children: ReactNode } & ButtonHTMLAttributes)` (sets `aria-label` and `title` to `label`)
  - `Card({ title?: string; children: ReactNode })`
  - `Field({ label: string; htmlFor: string; error?: string | null; children: ReactNode })`, `Input` and `Select` (styled native elements, props pass through)
  - `NumberField({ label: string; value: number | null; min?: number; max?: number; integer?: boolean; optional?: boolean; suffix?: string; placeholder?: string; onChange(v: number | null): void })` and `rangeMessage(min?, max?, integer?): string`.
    - With `integer`, the message says "whole number" (e.g. "Enter a whole number from 1 to 20").
    - With `optional`, an empty field commits `null`; without it, empty is invalid and `value` is never `null`.
    - `suffix` renders after the input (e.g. "lb"), and `placeholder` passes through.
  - `Pill({ tone?: "neutral" | "accent"; children: ReactNode })`, `EmptyState({ text: string })`
  - `ChipGroup<T extends string>({ label: string; options: { value: T; label: string; disabled?: boolean }[]; value: T[]; onChange(v: T[]): void; error?: string | null })`: a labelled `group` of toggle buttons (`aria-pressed`), ≥44px tall, wrapping. Tapping toggles membership, and `onChange` receives the new list in `options` order.

- [ ] **Step 1: Write failing tests**

`tests/ui/Button.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../../src/ui/Button";
import { IconButton } from "../../src/ui/IconButton";

describe("Button", () => {
  it("renders a button that defaults to type=button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("exposes its label as accessible name and title", () => {
    render(<IconButton label="Settings"><span>⚙</span></IconButton>);
    const btn = screen.getByRole("button", { name: "Settings" });
    expect(btn).toHaveAttribute("title", "Settings");
  });
});
```

`tests/ui/NumberField.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberField, rangeMessage } from "../../src/ui/NumberField";

describe("rangeMessage", () => {
  it("describes the allowed range", () => {
    expect(rangeMessage(1, 7)).toBe("Enter a number from 1 to 7");
    expect(rangeMessage(5)).toBe("Enter a number 5 or higher");
    expect(rangeMessage(undefined, 9)).toBe("Enter a number 9 or lower");
    expect(rangeMessage()).toBe("Enter a number");
  });
});

describe("NumberField", () => {
  it("commits a valid number on blur", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} min={1} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "3");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("commits on Enter", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "4{Enter}");
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("accepts decimals", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Increment" value={5} min={0} onChange={onChange} />);
    const input = screen.getByLabelText("Increment");
    await userEvent.clear(input);
    await userEvent.type(input, "2.5");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it("rejects out-of-range input: explains, reverts, never calls onChange", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} min={1} max={7} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "9");
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number from 1 to 7");
    expect(input).toHaveValue("2");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("rejects empty and non-numeric input", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "abc");
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("2");
  });

  it("clears the error when the user edits again", async () => {
    render(<NumberField label="Sets" value={2} min={1} onChange={() => {}} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    await userEvent.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(input, "1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows prop changes", () => {
    const { rerender } = render(<NumberField label="Sets" value={2} onChange={() => {}} />);
    rerender(<NumberField label="Sets" value={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Sets")).toHaveValue("5");
  });
});
```

`tests/ui/primitives.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../../src/ui/Card";
import { EmptyState } from "../../src/ui/EmptyState";
import { Field, Input } from "../../src/ui/Field";
import { Pill } from "../../src/ui/Pill";

describe("primitives", () => {
  it("Card renders an optional title", () => {
    render(<Card title="Units">body</Card>);
    expect(screen.getByRole("heading", { name: "Units" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
  it("Field associates its label with the control and shows an error", () => {
    render(
      <Field label="Name" htmlFor="n" error="Required">
        <Input id="n" defaultValue="" />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
  it("Pill renders its label", () => {
    render(<Pill tone="accent">Added</Pill>);
    expect(screen.getByText("Added")).toBeInTheDocument();
  });
  it("EmptyState shows its text", () => {
    render(<EmptyState text="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/ui`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `Button`, `IconButton`**

`src/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = "secondary", block = false, className, type = "button", ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[variant], block ? styles.block : "", className ?? ""].filter(Boolean).join(" ");
  return <button type={type} className={cls} {...rest} />;
}
```

`src/ui/Button.module.css`:
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-md);
  font-weight: 600;
  cursor: pointer;
}
.btn { transition: transform var(--dur-press) var(--ease-out), opacity var(--dur-press) var(--ease-out); }
/* Pressed state on touch-down, not on release. */
.btn:active:not(:disabled) { transform: scale(0.97); opacity: 0.85; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.block { width: 100%; }
.primary { background: var(--accent); color: var(--on-accent); }
.secondary { background: transparent; color: var(--text); border-color: var(--line); }
.ghost { background: transparent; color: var(--accent); padding: 0 10px; }
.danger { background: var(--danger); color: var(--on-danger); }
```

`src/ui/IconButton.tsx`:
```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={[styles.icon, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {children}
    </button>
  );
}
```

`src/ui/IconButton.module.css`:
```css
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--muted);
  cursor: pointer;
}
.icon { transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-press) var(--ease-out); }
.icon:active:not(:disabled) { transform: scale(0.92); background: var(--surface2); }
@media (hover: hover) {
  .icon:hover { color: var(--text); }
}
```

- [ ] **Step 4: Implement `Card`, `Field`/`Input`/`Select`, `Pill`, `EmptyState`**

`src/ui/Card.tsx`:
```tsx
import type { ReactNode } from "react";
import styles from "./Card.module.css";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={styles.card} aria-label={title}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {children}
    </section>
  );
}
```
`src/ui/Card.module.css`:
```css
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.title { font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
```

`src/ui/Field.tsx`:
```tsx
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

export function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string | null; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>{label}</label>
      {children}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.control, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={[styles.control, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}
```
`src/ui/Field.module.css`:
```css
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: var(--text-xs); color: var(--muted); }
.control {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  background: var(--surface2);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: max(16px, var(--text-base)); /* never under 16px: iOS zooms on focus below that */
}
.control[aria-invalid="true"] { border-color: var(--danger); }
.error { font-size: var(--text-xs); color: var(--danger); }
```

`src/ui/Pill.tsx`: a `<span>` with `styles.pill` and `styles[tone ?? "neutral"]`.
`src/ui/Pill.module.css`:
```css
.pill { display: inline-flex; align-items: center; font-size: var(--text-xs); font-weight: 500; padding: 2px 8px; border-radius: 999px; }
.neutral { color: var(--muted); background: var(--surface2); }
.accent { color: var(--accent); background: var(--accent-soft); }
```

`src/ui/EmptyState.tsx`:
```tsx
import styles from "./EmptyState.module.css";

export function EmptyState({ text }: { text: string }) {
  return <div className={styles.empty}>{text}</div>;
}
```
`src/ui/EmptyState.module.css`:
```css
.empty { padding: 40px 16px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: var(--radius-sm); font-size: var(--text-md); }
```

- [ ] **Step 5: Implement `NumberField` and `ChipGroup`**

`NumberField` follows the code below, extended per the Interfaces block. Validity is `trimmed === "" ? optional : (finite && in range && (!integer || Number.isInteger(n)))`, and an empty optional field commits `null`. Append these cases to `tests/ui/NumberField.test.tsx` before implementing:
  - `integer` rejects 2.5 with "Enter a whole number from 1 to 20";
  - `optional` commits `null` on an emptied field;
  - a non-optional field rejects empty;
  - `suffix` text renders.

`tests/ui/ChipGroup.test.tsx`:
  - a `group` named by `label`, with one `button` per option;
  - selected options have `aria-pressed="true"`;
  - clicking an unselected option calls `onChange` with it added, in options order;
  - clicking a selected one removes it;
  - a disabled option can't be toggled;
  - `error` renders under the group as `role="alert"`.

`src/ui/NumberField.tsx` (2026-10-09 base; extend it as described above):
```tsx
import { useEffect, useId, useState } from "react";
import { Field, Input } from "./Field";

export function rangeMessage(min?: number, max?: number): string {
  if (min != null && max != null) return `Enter a number from ${min} to ${max}`;
  if (min != null) return `Enter a number ${min} or higher`;
  if (max != null) return `Enter a number ${max} or lower`;
  return "Enter a number";
}

export interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

// Lets the user type freely; commits a valid number on blur or Enter. Anything invalid
// (empty, non-numeric, out of range) explains itself and reverts to the last good value.
export function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const trimmed = text.trim();
    const n = Number(trimmed);
    const valid = trimmed !== "" && Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max);
    if (valid) {
      setError(null);
      if (n !== value) onChange(n);
    } else {
      setError(rangeMessage(min, max));
      setText(String(value));
    }
  }

  return (
    <Field label={label} htmlFor={id} error={error}>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        aria-invalid={error ? "true" : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </Field>
  );
}
```

`src/ui/ChipGroup.tsx`: implement per the Interfaces block (a `role="group"` with `aria-labelledby` on a visible label, and `Button`-styled toggle chips with `aria-pressed`). Pressed chips use `--accent-soft` and `--accent`.

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (the typography-floor test also scans the new CSS: all sizes ≥13px).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ui): add Button, Card, Field, NumberField, Pill, ChipGroup and EmptyState" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Motion foundation: springs, gestures, Segmented, Sheet, SheetStack, Toast

This is where the UI stops being static. Every later screen uses these pieces, so their feel is decided here: interruptible springs, 1:1 drags, momentum projection and symmetric paths (apple-design §1–7, 9, 14).

**Files:**
- Modify: `package.json` (add `"motion": "13.5.1"`, exact pin), `tests/setup.ts` (skip animations in tests)
- Create: `src/ui/motion.ts`, `src/ui/gesture.ts`, `src/ui/Segmented.tsx`, `Segmented.module.css`, `src/ui/Sheet.tsx`, `Sheet.module.css`, `src/ui/SheetStack.tsx`, `SheetStack.module.css`, `src/ui/Toast.tsx`, `Toast.module.css`
- Test: `tests/ui/gesture.test.ts`, `tests/ui/Segmented.test.tsx`, `tests/ui/Sheet.test.tsx`, `tests/ui/SheetStack.test.tsx`, `tests/ui/Toast.test.tsx`

**Interfaces (produces):**
- `motion.ts`:
  - `SPRING = { default: { type: "spring", bounce: 0, duration: 0.4 }, snappy: { type: "spring", bounce: 0, duration: 0.3 }, momentum: { type: "spring", bounce: 0.2, duration: 0.3 } } as const`. `momentum` is used only after a release whose speed exceeds `FLICK = 300` px/s.
  - `MotionRoot({ children })` = `<MotionConfig reducedMotion="user" transition={SPRING.default}>`.
- `gesture.ts`, all pure:
  - `project(velocity: number, decelerationRate = 0.998): number` → `(velocity / 1000) * decelerationRate / (1 - decelerationRate)` (Apple's projection).
  - `rubberband(overshoot: number, dimension: number, constant = 0.55): number` → `(overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))`, sign preserved.
  - `commitOnRelease(offset: number, velocity: number, size: number): boolean`. It commits (dismiss or go back) when the projected end `offset + project(velocity)` is past `size / 2`. A release moving back toward the start faster than `FLICK` px/s never commits, because the velocity sign decides reversal.
- `Segmented<T extends string>({ label: string; value: T | null; options: { value: T; label: string }[]; onChange(v: T): void })`. This is the 2026-10-09 API, except `value` may be `null` (no option checked and no thumb shown), which the Create view uses for an unselected Type.
  - It is a `radiogroup` of `radio` buttons. The thumb is one `motion.span` with a per-instance `layoutId` and `SPRING.snappy`, so it slides from wherever it is, even mid-slide.
  - ArrowLeft/ArrowRight move the selection.
- `Sheet({ title, onClose, onBack?, backLabel?, headerAction?, children })`, a modal bottom sheet:
  - Structure: `role="dialog"`, `aria-modal`, labelled by its title. Done and Escape call `onClose`. Focus moves into the sheet on open and back to the opener on unmount. Back appears only with `onBack`.
  - Enter and exit: it enters with `y: "100%" → 0` and exits back down (`AnimatePresence`, `SPRING.default`).
  - Drag: the grabber and header are a drag handle (`drag="y"`). Down follows the finger 1:1 from the grab point; up goes through `rubberband`. On release it decides with `commitOnRelease(offsetY, velocityY, height)`.
  - Release: on commit it animates to `height` with the release velocity (`SPRING.momentum` if `|v| > FLICK`), then calls `onClose` once. Otherwise it springs back to 0.
  - Before closing (Done, Escape, or a committed drag), blur `document.activeElement` if it is inside the sheet, so a NumberField commits what was typed before it unmounts. Test: "a value typed in a field commits when Done is pressed" (wave 1 review).
  - Scrim and push-back: the scrim's opacity follows the sheet's y. The sheet writes `--sheet-progress` (0 = fully open, 1 = gone) on `document.documentElement` on every frame and removes it on unmount, so the page behind can scale and dim in step. A Done press during a drag closes once.
- `SheetStack({ root: SheetView, onClose })` with `SheetView = { id: string; title: string; render(nav: SheetNav): ReactNode; headerAction?: ReactNode }` and `SheetNav = { push(v: SheetView): void; pop(): void; popToRoot(): void; depth: number }`. Also `useSheetNav(): SheetNav`.
  - Layout: it renders one `Sheet` whose title and Back follow the top view. Back is labelled with the previous view's title and pops.
  - Push: the incoming view slides in from `x: "100%"` while the parent shifts to `x: "-30%"` and dims.
  - Pop: the reverse, along the same path.
  - Edge swipe: a drag starting within 20px of the left edge tracks 1:1 and pops when `commitOnRelease(offsetX, velocityX, width)`.
- `Toast` is driven by the UI store (Task 6). Here it's presentational: `ToastView({ toast: { id: string; text: string; action?: { label: string; onAction(): void } }, onDismiss })`.
  - Rendered in a `role="status"` live region.
  - It enters from the bottom above the tab bar and leaves the same way.
  - A downward drag with `commitOnRelease` dismisses it.

- [ ] **Step 1: Add the dependency and test setup**
  - `npm install motion@13.5.1 --save-exact`.
  - Add to `tests/setup.ts`: `import { MotionGlobalConfig } from "motion/react"; MotionGlobalConfig.skipAnimations = true;`. jsdom can't run frame-based animation, so tests assert end states. The physics is covered by `gesture.test.ts`.

- [ ] **Step 2: Write the failing tests**

`tests/ui/gesture.test.ts`:
```ts
expect(project(1000)).toBeCloseTo(499, 0);              // 1 × 0.998 / 0.002
expect(project(-1500)).toBeCloseTo(-748.5, 1);
expect(project(1000, 0.99)).toBeCloseTo(99, 0);
expect(rubberband(100, 800)).toBeCloseTo(51.46, 1);    // 100·800·0.55 / (800 + 55)
expect(rubberband(-100, 800)).toBeCloseTo(-51.46, 1);
expect(rubberband(0, 800)).toBe(0);
expect(commitOnRelease(100, 0, 600)).toBe(false);       // slow, not past half
expect(commitOnRelease(350, 0, 600)).toBe(true);        // past half
expect(commitOnRelease(100, 1500, 600)).toBe(true);     // flick: projects to ~848
expect(commitOnRelease(400, -800, 600)).toBe(false);    // moving back up: the sign wins
```
- `tests/ui/Segmented.test.tsx`: keep the 2026-10-09 cases (radiogroup with the active option checked; `onChange` with the chosen value), and add "ArrowRight moves to the next option and calls onChange" and "value null checks no option".
- `tests/ui/Sheet.test.tsx`: keep the 2026-10-09 cases (labelled modal dialog that takes focus; Done and Escape close it; Back only with `onBack`; focus returns to the opener on unmount). Add:
  - "sets --sheet-progress while open and removes it on unmount";
  - "Done pressed twice calls onClose once" (the second press lands during the exit);
  - "renders headerAction in the header".
- `tests/ui/SheetStack.test.tsx`:
  - the root title shows with no Back;
  - `push` shows the new title with Back labelled with the root title;
  - Back pops;
  - `popToRoot` from depth 3 returns to the root;
  - Escape closes the whole stack (`onClose` once) at any depth.
- `tests/ui/Toast.test.tsx`:
  - text and action button render inside `role="status"`;
  - pressing the action calls `onAction` then `onDismiss`.

- [ ] **Step 3: Run and confirm failure**: `npx vitest run tests/ui`. Expected: FAIL, because the modules are missing.

- [ ] **Step 4: Implement** the files above.
  - Drag handling uses `motion`'s `drag` with `dragListener={false}` and `dragControls`, started from the handle's `onPointerDown`. That way only the handle starts a drag and content inside the sheet keeps scrolling.
  - Velocity comes from the `onDragEnd` `info.velocity`. The release animation is `animate(y, target, { ...spring, velocity })`.
  - Sheet CSS: `--material` background, top corners `--radius`, a 36×5px grabber with a 44px hit area.
  - Under `prefers-reduced-transparency` the background is solid `--surface`.

- [ ] **Step 5: Gate**: `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 6: Commit**: `git add -A && git commit -m "feat(ui): add spring motion layer with draggable sheet, sheet navigation stack, sliding segmented control and toast" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: Exercise and phase helpers

**Files:**
- Create: `src/domain/exercises.ts`, `tests/domain/exercises.test.ts`
- Modify: `src/domain/settings.ts`, `src/domain/library/index.ts`, `src/domain/library/catalog.ts` (export the label map), `tests/domain/settings.test.ts`, `tests/domain/library.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `StoreDoc`, `Settings`, `Style`, `Muscle` (types); `REGION_OF`, `Region` (`library/muscles.ts`); `LIBRARY`, `LibraryExercise`, `customExercise` (`library/index.ts`); `phaseOf`.
- Produces:
  - `exercises.ts`:
    - `REGIONS: readonly Region[]` = `["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"]`
    - `regionOf(ex: Exercise): Region` → `REGION_OF[ex.primary[0]]`
    - `groupByRegion(exercises: Exercise[], opts?: { archived?: boolean }): { region: Region; exercises: Exercise[] }[]`
      - non-empty regions only, in `REGIONS` order, exercises sorted by name;
      - by default archived exercises are excluded; with `archived: true` only archived ones are listed.
    - `sessionsWithExercise(doc: StoreDoc, id: string): number`
    - `deleteExerciseCascade(doc: StoreDoc, id: string): StoreDoc` removes the exercise, its blocks, and any session left with no blocks.
    - `libraryState(doc: StoreDoc, libraryId: string): { status: "new" } | { status: "added" | "archived"; exerciseId: string }`
  - `library/index.ts`:
    - `exerciseError(input: { name: string; primary: Muscle[]; step?: number | null }): string | null`, with the same three messages as `customExercise` (which now calls it);
    - `equipmentLabel(e: Equipment): string` (the catalog's labels: "Smith machine", "EZ bar" …);
    - `groupByMovement(entries: LibraryExercise[]): { movement: string; entries: LibraryExercise[] }[]`, in order of first appearance.
  - `settings.ts`:
    - `startPhase(settings: Settings, style: Style, today: string): Settings`. If the current phase already has `style`, it returns `settings` unchanged (same object). If the current phase started `today`, it changes that phase's style instead of adding one. When that makes it equal to the phase before it, the phase is removed instead. Otherwise it appends `{ id: \`phase-${today}\`, style, startDate: today }`.
    - `setPhaseStart(settings: Settings, phaseId: string, date: string, today: string): Settings | { error: string }`. Errors:
      - `"Start date can't be in the future"`;
      - `"Start date must be after the previous phase starts"` (date ≤ previous phase's startDate);
      - `"Start date must be before the next phase starts"`.

- [ ] **Step 1: Write the failing tests** (build with `tests/helpers/build.ts`):
  - **Grouping:**
    - `groupByRegion` puts a lateral raise (`primary: ["side-delts"]`) under Shoulders.
    - Regions come in `REGIONS` order and names sort within a region.
    - An archived exercise is absent by default and is the only one listed with `{ archived: true }`.
  - **Cascade and counts:**
    - `deleteExerciseCascade`: a session with blocks for `a` and `b` keeps `b`; a session with only `a` is removed; other exercises are untouched.
    - `sessionsWithExercise` counts sessions, not blocks: two `a` blocks on one day count 1.
  - **Library state:**
    - `"new"` for an unknown libraryId.
    - `{ status: "added", exerciseId }` for an active one.
    - `{ status: "archived", exerciseId }` when archived.
  - **Library helpers:**
    - `exerciseError({ name: " ", primary: ["chest"] })` → `"Name can't be empty"`.
    - `exerciseError({ name: "x", primary: [] })` → `"Pick at least one muscle worked"`.
    - `exerciseError({ name: "x", primary: ["chest"], step: 0 })` → `"Step must be more than 0"`.
    - `exerciseError({ name: "x", primary: ["chest"] })` → `null`.
    - `equipmentLabel("smith")` → `"Smith machine"`.
    - `groupByMovement(searchLibrary("bench press"))` has a `"Bench press"` group with 4 entries.
  - **`startPhase`:**
    - from one hypertrophy phase (09-01) to strength on 10-17 → two phases, the new one `{ id: "phase-2026-10-17", style: "strength", startDate: "2026-10-17" }`;
    - same style → the same object;
    - switching again on 10-17 back to hypertrophy → back to one phase (no zero-length phase);
    - a phase that started today with no previous phase just changes style.
  - **`setPhaseStart`:**
    - a future date → future error;
    - a date on or before the previous phase's start → previous error;
    - a valid date → that phase's `startDate` changes and the others are untouched.

- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/domain`. Expected: FAIL in the new cases only.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Gate.** Expected: PASS, with every existing engine and library test still green.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(domain): add region grouping, library state, cascade delete and phase editing helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 6: App store and UI store

**Files:**
- Create: `src/state/appStore.ts`, `src/state/uiStore.ts`, `tests/helpers/seed.ts`, `tests/state/appStore.test.ts`, `tests/state/uiStore.test.ts`

**Interfaces:**
- Consumes: `bootStore`, `hasLegacyData`, `saveDoc`, `emptyDoc`, `convertUnits`, `startPhase`, `setPhaseStart`, `exerciseFromLibrary`, `customExercise`, `deleteExerciseCascade`, `libraryState`, `LibraryExercise`, `KeyValueStore`, `todayYmd`.
- Produces:
  - `createAppStore(kv: KeyValueStore, opts?: { today?: () => string; newId?: () => string }): StoreApi<AppState>` (defaults: `todayYmd`, `crypto.randomUUID`):
    ```ts
    interface AppState {
      status: "loading" | "ready" | "error"; error: string | null;
      bootKind: "v2" | "fresh" | null; hasLegacy: boolean; warnings: string[];
      doc: StoreDoc; saveError: string | null;
      init(): Promise<void>;                                            // idempotent: repeated calls share one boot
      updateSettings(fn: (s: Settings) => Settings): Promise<boolean>;
      setUnit(unit: Unit): Promise<boolean>;                            // convertUnits, one save
      startPhase(style: Style): Promise<boolean>;
      setPhaseStart(phaseId: string, date: string): Promise<string | null>;  // error text, or null when saved
      addFromLibrary(entry: LibraryExercise): Promise<string | null>;   // exercise id; restores an archived one; never duplicates
      addCustom(input: Parameters<typeof customExercise>[0]): Promise<{ id: string } | { error: string }>;
      updateExercise(id: string, patch: Partial<Pick<Exercise, "name" | "primary" | "secondary" | "step" | "equipment" | "class">>): Promise<boolean>;
      setArchived(id: string, archived: boolean): Promise<boolean>;
      deleteExercise(id: string): Promise<boolean>;
      replaceDoc(doc: StoreDoc): Promise<boolean>;
      dismissSaveError(): void;
    }
    ```
    Every mutating action updates `doc` immediately, then persists with `saveDoc`. On a write error it restores the previous `doc`, sets `saveError = "Couldn't save: <message>"` and returns `false` / `null` / an `{ error }`.
  - `UI_KEY = "overload.v2.ui"`; `type Tab = "log" | "progress" | "history"`; `type SheetId = "settings"`; `interface Toast { id: string; text: string; action?: { label: string; onAction(): void } }`.
  - `createUiStore(kv): StoreApi<UiState>` with `{ tab; sheet: SheetId | null; toast: Toast | null; setTab; openSheet; closeSheet; showToast(t: Omit<Toast, "id">): void; dismissToast(): void; hydrate(): Promise<void> }`.
    - Persisted JSON is `{ version: 1, tab }`.
    - A toast auto-dismisses after 6000 ms, and a new toast replaces the current one.
    - UI-state I/O errors are swallowed.
  - `tests/helpers/seed.ts`: `seedDoc(d: StoreDoc)` → a memory KV holding `overload.v2`; `seedLegacy(raw?: Record<string, string>)` → a memory KV holding raw legacy keys (default: one tiny exercise and session in the old shape).

- [ ] **Step 1: Write the failing tests** (`tests/state/appStore.test.ts`; a `failing(kv)` wrapper makes `set` throw):
  - **Boot:**
    - Legacy keys only → `bootKind: "fresh"`, `hasLegacy: true`, empty doc. Only `overload.v2` was added, and legacy values are byte-identical.
    - An existing v2 → `"v2"`.
    - A corrupt v2 → `status: "error"` and nothing written.
    - `init()` twice → one boot.
  - **Units:** `setUnit("kg")` on a doc with 225×5 and 0×10 sets stores `[102.1, 0]`, `unit: "kg"` and the kg steps. With a failing KV it returns `false`, `doc.settings.unit` is still `"lb"`, the weights are still `[225, 0]`, and `saveError` starts with `"Couldn't save:"`.
  - **Phases:**
    - `startPhase("strength")` (with `today: () => "2026-10-17"`) appends the phase and persists it.
    - Calling `startPhase("hypertrophy")` the same day leaves one phase.
    - `setPhaseStart` returns the error text for a future date and writes nothing.
  - **Library:**
    - `addFromLibrary(bench)` returns a new id. A second call returns the same id and the doc still has one exercise.
    - After `setArchived(id, true)`, `addFromLibrary(bench)` returns that id with `archived: false`.
  - **Custom:** `addCustom` with a blank name → `{ error: "Name can't be empty" }`, nothing written. A valid input → `{ id }` with `libraryId: null`.
  - **Edits and delete:**
    - `updateExercise(id, { step: 2.5 })` persists.
    - `deleteExercise` cascades.
    - Archive with a failing KV → returns `false`, the exercise is still active, and `saveError` is set.

  `tests/state/uiStore.test.ts`:
  - **Tabs:** tabs persist and restore. An unknown stored tab falls back to `"log"`.
  - **Sheet:** `openSheet` / `closeSheet`. The sheet isn't persisted.
  - **Toasts** (fake timers):
    - `showToast` sets a toast with an id; it clears after 6000 ms.
    - A second toast replaces the first and restarts the timer.
    - `dismissToast` clears it.
  - **Errors:** a KV that throws doesn't break `hydrate` or `setTab`.

- [ ] **Step 2: Run and confirm failure**: `npx vitest run tests/state`. Expected: FAIL, because the modules are missing.
- [ ] **Step 3: Implement.** Use Zustand `createStore` (vanilla). Actions use one internal `commit(next: StoreDoc)` that sets, saves and rolls back.
- [ ] **Step 4: Gate.** Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(state): add app store over the new model with rollback, and ui store with tabs, sheet and toasts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 7: App shell: chrome, tabs, sheet and toast hosts, error screens

**Files:**
- Create: `src/state/context.tsx`, `src/app/Shell.tsx`, `Shell.module.css`, `Header.tsx`, `Header.module.css`, `TabBar.tsx`, `TabBar.module.css`, `ErrorBoundary.tsx`, `ErrorScreen.tsx`, `Banner.tsx`, `Banner.module.css`, `download.ts`, `src/features/placeholders.tsx`, `tests/helpers/blob.ts`, `tests/helpers/renderWithStore.tsx`, `tests/app/shell.test.tsx`, `tests/app/download.test.ts`
- Modify: `src/app/App.tsx` (replace the stub), `src/data/boot.ts` (add `dumpRaw`), `tests/data/boot.test.ts` (one test)

**Interfaces:**
- Consumes: `createAppStore`, `createUiStore`, `applyTheme`, `themePreference`, `MotionRoot`, `SheetStack`, `ToastView`, `EmptyState`, `IconButton`.
- Produces:
  - `dumpRaw(kv): Promise<Record<string, string>>`: legacy keys **plus** `overload.v2` when present (for the boot-error escape hatch).
  - `downloadText(filename, text, mime?)`, which is the only place a file leaves the app. `backupFilename(now?: Date)` → `overload-backup-YYYY-MM-DD.json`, and `oldDataFilename(now?)` → `overload-old-app-data-YYYY-MM-DD.json`, both from **local** date parts.
  - `StoreProvider`, `useApp(selector)`, `useUi(selector)`, `useKv()`, `useAppStore()`, `useUiStore()`.
  - `Shell()` and `App({ kv })`.
  - `renderWithStore(ui, opts?: { doc?: StoreDoc; legacy?: Record<string, string>; kv?: MemoryKV; init?: boolean })` → `{ ...render, kv, app, uiStore, user }`. The default is an empty v2 doc from `doc()`.

Shell behavior:
- **Tabs:** `TabBar` is a `tablist` of three `tab`s: **Log** (Dumbbell icon), **Progress** (TrendingUp), **History** (CalendarDays). Each shows an icon and a label. It sits above the home indicator (`env(safe-area-inset-bottom)`).
- **Header:** shows a large title per tab inside the scrolling content, and a gear `IconButton` labelled "Settings".
  - When the large title scrolls under the header (IntersectionObserver), the header shows the small centered title.
  - Header and tab bar switch to their translucent material with a fade edge only while content is under them (`data-scrolled`).
- **Settings sheet:** the gear opens it (`openSheet("settings")`) as a `SheetStack` whose root is a placeholder until Task 8. While it's open the page is `inert` and scales `calc(0.94 + 0.06 * var(--sheet-progress, 1))` with top corners rounded. That's skipped under reduced motion, which only dims.
- **Toasts:** `ToastView` renders the UI store's toast above the tab bar.
- **Save errors:** a failed save shows a `Banner` with `role="alert"` and Dismiss.
- **Boot errors:** a boot error shows `ErrorScreen`: the message plus "Download raw data" (`dumpRaw`). Nothing is written. `ErrorBoundary` catches render errors with "Something broke" and Reload.
- **No migration banner.**

- [ ] **Step 1: Write the failing tests**
  - **Data and download:**
    - `boot.test.ts`: "dumpRaw includes overload.v2 as well as legacy keys".
    - `download.test.ts`: keep the 2026-10-09 cases (blob URL created, clicked with the filename and revoked; the local date, not UTC, for a late-evening export). Add that `oldDataFilename` uses the local date.
  - **Tabs:**
    - tablist with exactly Log, Progress, History, and the gear once ready;
    - switching tabs persists, and a reload restores the tab.
  - **Settings sheet:**
    - the gear opens a dialog named "Settings" and the page behind is `inert`;
    - Done closes it, `inert` is removed, `--sheet-progress` is gone, and focus returns to the gear.
  - **Theme:** a stored `"light"` sets `data-theme="light"`.
  - **Save errors:** a failed save shows the alert, and Dismiss clears it.
  - **Boot:**
    - Boot on a device with only legacy keys: no banner, the Log placeholder, and only `overload.v2` added.
    - Corrupt v2: the error screen, and "Download raw data" yields a file containing `overload.v2`.
    - A StrictMode double mount boots once.
  - **Toast:** a toast from the UI store renders with its action.
  - **ErrorBoundary:** renders a recoverable screen with the error message.

- [ ] **Step 2: Run and confirm failure.** Expected: FAIL, because the modules are missing.
- [ ] **Step 3: Implement.** `App` wraps everything in `MotionRoot` and `StoreProvider`, hydrates the UI store, calls `init()` and applies the theme on every change.
- [ ] **Step 4: Gate.** Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(app): add shell with translucent chrome, Log/Progress/History tabs, settings sheet host, toasts and error screens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 8: Settings sheet

**Files:**
- Create: `src/ui/ListRow.tsx`, `ListRow.module.css`, `src/features/settings/SettingsRoot.tsx`, `StyleRulesView.tsx`, `EquipmentStepsView.tsx`, `Settings.module.css`, `src/app/readFile.ts`, `tests/features/settings.test.tsx`
- Modify: `src/app/Shell.tsx` (the sheet root becomes `SettingsRoot`), `src/features/placeholders.tsx` (drop the settings placeholder)

**Interfaces:**
- Consumes: the store actions from Task 6; `useSheetNav`; `Segmented`, `NumberField`, `Card`, `Button`, `Banner`; `downloadText`, `backupFilename`, `oldDataFilename`, `exportBackup`, `parseBackup`, `dumpLegacyRaw`; `phaseOf`, `convertUnits` (to count before confirming), `EQUIPMENT`, `equipmentLabel`.
- Produces:
  - `ListRow({ label: string; detail?: string; onPress?(): void; children?: ReactNode })`: an iOS grouped-list row (≥44px, chevron when `onPress`, pressed state on touch-down).
  - `SettingsRoot()`, `StyleRulesView()`, `EquipmentStepsView()`.
  - `readFileText(file: File): Promise<string>`.

Sections in `SettingsRoot`, as iOS grouped inset lists, in this order:
1. **Training.**
   - "Style": a `Segmented` with Strength/Hypertrophy calling `startPhase`.
   - Below it, `"{Style} since {Mon D}"` and a "Started" date input (`max` = today) that calls `setPhaseStart`; an error shows inline.
   - A "Style rules" row pushes `StyleRulesView`.
2. **Exercises.** An "Exercise library" row with detail `"{n} exercises"` pushes the library (Task 9; a placeholder view until then).
3. **Units.**
   - A `Segmented` with lb/kg. If `convertUnits` reports 0 changed sets and there are no step overrides, it switches at once.
   - Otherwise an inline confirmation appears in the section: `"Convert {n} logged set{s} to {unit}? Switching back restores the exact numbers. Equipment steps reset to {unit} defaults."`, plus `" {k} custom step{s} will be cleared."` when k > 0. Buttons are **Convert** (primary) and **Cancel**. The Segmented shows the old unit until Convert succeeds.
4. **Equipment steps.** A row with detail `"Per gym"` pushes `EquipmentStepsView`: one `NumberField` per equipment except band, labelled `"{Equipment label} ({unit})"`, min 0.1, decimals allowed.
5. **Appearance.** A `Segmented` with System/Dark/Light.
6. **Data & backup.**
   - "Export backup" downloads `exportBackup(doc)`.
   - "Import backup" opens a file picker, then `parseBackup`.
     - If invalid, the error text shows inline (v1 shows "This backup is from the old app and can't be imported").
     - If valid, an inline confirmation appears: `"Replace your data with this backup? It has {e} exercises and {s} sessions."` with **Replace** (danger) and **Cancel**. Replace calls `replaceDoc` and shows a toast "Backup imported".
   - "Download old app data" appears only when `hasLegacy`. It downloads `JSON.stringify(await dumpLegacyRaw(kv), null, 2)` as `oldDataFilename()`. Caption: "Your workouts from the previous version, as a file."

`StyleRulesView` shows the current style first, with a `Segmented` to view the other one.
- **Compound** and **Isolation** sections each have Rep range low/high (whole numbers 1–50), Sets (1–20), Target RIR low/high (0–4), Rest in seconds (0–900) and Warm-up sets (0–10).
- **Weekly volume** has low/high sets (0–60).
- A pair where low > high shows "Low can't be above high" under the pair and isn't saved.

- [ ] **Step 1: Write the failing tests** (`tests/features/settings.test.tsx`, via `renderWithStore` with `SettingsRoot` inside a `SheetStack`):
  - **Training style:**
    - Choosing Strength stores a new phase dated today, and the caption reads "Strength since …".
    - A future Started date shows "Start date can't be in the future" and writes nothing.
  - **Style rules:**
    - Push and Back works.
    - Hypertrophy compound repLow 12 with repHigh 10 shows "Low can't be above high" and stores nothing.
    - Sets 2.5 shows the whole-number message.
    - A valid rest of 150 is stored.
  - **Units:**
    - Empty doc: choosing kg switches immediately (unit kg, kg steps).
    - With 3 logged sets and 1 step override: the confirmation reads "Convert 3 logged sets to kg? Switching back restores the exact numbers. Equipment steps reset to kg defaults. 1 custom step will be cleared."
      - Cancel leaves everything unchanged.
      - Convert stores the converted weights.
  - **Equipment steps:** dumbbell 2.5 is stored; 0 shows the range message.
  - **Appearance:** Dark is stored and applied.
  - **Export:** produces a v2 file named with the local date.
  - **Import:**
    - A v1 file shows the old-app message and leaves data intact.
    - Non-JSON shows "Backup file is not valid JSON".
    - A valid file shows the counts. Cancel changes nothing; Replace replaces the data and shows the toast.
  - **Old app data:** "Download old app data" is absent on a clean device. With legacy keys it is present and downloads exactly those keys.

- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement.** Pairs validate in the view, so the store only ever receives a valid `Settings`.
- [ ] **Step 4: Gate.** Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(settings): add settings sheet with training style, style rules, converting units, equipment steps and backups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 9: Exercise library

**Files:**
- Create: `src/features/exercises/LibraryView.tsx`, `ExerciseDetailView.tsx`, `AddExerciseView.tsx`, `ChooseEquipmentView.tsx`, `CreateExerciseView.tsx`, `Exercises.module.css`, `tests/features/exercises.test.tsx`
- Modify: `src/features/settings/SettingsRoot.tsx` (the "Exercise library" row pushes `LibraryView`)

**Interfaces:**
- Consumes: the store's `addFromLibrary`, `addCustom`, `updateExercise`, `setArchived`, `deleteExercise`; the UI store's `showToast`; `groupByRegion`, `libraryState`, `sessionsWithExercise`, `searchLibrary`, `groupByMovement`, `equipmentLabel`, `exerciseError`, `MUSCLE_LABEL`, `MUSCLES`, `EQUIPMENT`, `loadStep`; `useSheetNav`, `ListRow`, `ChipGroup`, `Pill`, `Segmented`, `NumberField`, `Input`, `Select`, `Button`, `EmptyState`.
- Produces: the five views (each a `SheetView` factory, e.g. `libraryView(): SheetView`).

**LibraryView ("Exercise library")**
- The header action is a "+" `IconButton` labelled "Add exercise", which pushes `AddExerciseView`.
- My exercises are listed by `groupByRegion`, one section per region. Each row shows the name, with detail `"{Equipment label} · {primary muscle labels joined by ", "}"`. Tapping a row pushes `ExerciseDetailView`.
- An "Archived ({n})" row appears last when n > 0. It pushes a list of archived exercises, each with a **Restore** button.
- When empty: `EmptyState` "No exercises yet. Add one from the library." plus an "Add exercise" button.

**AddExerciseView ("Add exercise")**
- A search `Input` (`type="search"`, focused on open, placeholder `"Search {LIBRARY.length} exercises"`) filters on every keystroke. Results are `groupByMovement(searchLibrary(q))`.
- A movement with one entry is a single row:
  - tapping it adds the exercise (`addFromLibrary`), pops to the root and shows the toast `"Added {name}"`;
  - an already-added entry shows a "Added" `Pill` and is disabled;
  - an archived one shows "Restore".
- A movement with several entries is a row with detail `"{n} options"` that pushes `ChooseEquipmentView`, which lists its entries the same way.
- The last row is "Can't find it? Create your own", which pushes `CreateExerciseView`.
- No results: "No matches. Create your own instead." with the same row.

**CreateExerciseView ("New exercise")**
- **Fields:**
  - Name;
  - Equipment (`Select` with `equipmentLabel`);
  - Muscles worked (primary `ChipGroup` over `MUSCLES` with `MUSCLE_LABEL`);
  - Also works (secondary `ChipGroup`; a muscle chosen as primary is disabled here);
  - Type (`Segmented` Compound/Isolation, starting unselected);
  - Weight step (optional `NumberField`, placeholder `"Default ({step} {unit})"`).
- **Save:**
  - Validates with `exerciseError`, plus "Pick compound or isolation" when Type is unset.
  - Errors show under their field.
  - On success it calls `addCustom`, pops to the root and shows the toast `"Added {name}"`.

**ExerciseDetailView ({exercise name})**
- **Fields:**
  - Name: commits on blur/Enter; blank shows "Name can't be empty" and isn't saved.
  - Muscles worked / Also works chips: commit on change; removing the last primary is refused with "Pick at least one muscle worked".
  - Weight step: optional, with a "Use default" button that stores `null`.
- **Library vs custom:**
  - A library exercise shows "From the library · {Equipment label}" as text: equipment and type are fixed.
  - A custom exercise also edits Equipment and Type.
- **Archive exercise:** archives, pops to the root and shows the toast `"Archived {name}"` with an **Undo** action (`setArchived(id, false)`). If the save fails, there's no toast (the shell's save-error alert shows instead).
- **Delete permanently…** (smaller, danger text, at the bottom):
  - It arms an inline confirmation: `"Deletes {name} and its {n} logged session{s}. This can't be undone."`, or `"Deletes {name}. It has no logged sessions."`.
  - **Delete** (danger) and **Cancel**.
  - Delete cascades, pops to the root and shows the toast `"Deleted {name}"` with no Undo.

- [ ] **Step 1: Write the failing tests** (`tests/features/exercises.test.tsx`):
  - **Library list:**
    - Empty library shows the empty state.
    - Two exercises in different regions list under their region headings, with the detail text "Dumbbell · Side delts".
  - **Adding:**
    - Typing "db bench" lists "Bench press (dumbbell)".
    - Typing "lateral raise" shows one "Lateral raise" row with "3 options". Pushing it and choosing dumbbell adds it, returns to the root and shows the toast "Added Lateral raise (dumbbell)".
    - Adding the same entry again shows it as "Added" and disabled (one exercise in the doc).
    - An archived entry shows "Restore", and restoring it brings it back with its id.
  - **Creating:**
    - "Can't find it?" leads to New exercise.
    - Saving with no name, no muscles and no type shows the three messages and writes nothing.
    - A valid custom exercise is stored with `libraryId: null` and shown under its region.
  - **Detail:**
    - A blank name isn't saved.
    - Removing the only primary muscle is refused with its message.
    - Step 2.5 is stored, and "Use default" stores null.
    - A library exercise shows "From the library · Dumbbell" and no equipment select.
  - **Archive:**
    - Archiving hides the exercise from the list, shows "Archived (1)" and the Undo toast; Undo restores it.
    - With a failing KV: no toast, the exercise is still listed, and the save alert shows.
  - **Delete:**
    - The confirmation states the session count. Cancel deletes nothing.
    - Delete cascades into sessions.

- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement.** Toasts that follow a store action are shown only when the action resolves `true`/an id.
- [ ] **Step 4: Gate.** Expected: PASS.
- [ ] **Step 5: Commit**: `git add -A && git commit -m "feat(exercises): add exercise library with search, equipment choice, create-your-own, archive with undo and costed delete" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 10: Device check, motion review and handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Full gate and build**: `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass, and `dist/next.html`, `dist/dev.html` and `dist/index.html` exist.
- [ ] **Step 2: Old-device boot.** Run `npm run dev` and open `/next.html` at 390×844 (Playwright MCP).
  - Seed the four legacy keys from `fixtures/real-backup.json` (read it; never modify `fixtures/`) and reload.
  - Confirm:
    - the Log tab shows (no banner);
    - `localStorage` gained only `overload.v2`;
    - each legacy key is byte-identical to the seeded value;
    - Settings → Data & backup shows "Download old app data".
- [ ] **Step 3: Walk the flows.**
  1. Add three exercises from the library, one through Choose equipment, and create one custom.
  2. Archive one and press Undo.
  3. Switch to kg and confirm, then switch back.
  4. Change the style to Strength.
  5. Open Style rules and go Back.
  6. Drag the sheet down halfway and release (it springs back), then flick it (it closes).
  7. Edge-swipe back from a pushed view.

  Expected: no console errors, and `overload.v2` matches what the UI shows.
- [ ] **Step 4: Screenshots and motion review.**
  - Capture every screen and view in light and dark at 390×844, with `prefers-reduced-motion: reduce` once (slides become fades).
  - Record one sheet drag-and-flick and one push/pop at 0.25× speed (`page.clock` or a CSS animation-rate override) and check there are no jumps on interrupt.
  - Save to the scratchpad. Dylan reviews them, and then the motion on his phone.
- [ ] **Step 5: HANDOFF.md.** Add under `## Next`:
  ```
  State Update <date>: UI Foundation (Plan A) done on `rewrite`: tokens + contrast gate, primitives, spring motion layer (draggable sheet, sheet nav stack, sliding segmented, toasts), stores over the new model, shell (Log · Progress · History, translucent chrome), Settings (style/phases, style rules, converting units, equipment steps, backups, old-data download), Exercise library (search, create, archive + undo). Served at /next.html.
  Next: Plan B (Log + coaching card on targetsFor + per-set RIR + rest timer + UI-state persistence).
  ```
- [ ] **Step 6: Commit**: `git add -A && git commit -m "docs: update handoff after UI foundation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`
