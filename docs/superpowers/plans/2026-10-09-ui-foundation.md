# UI Foundation (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design system, app store, shell (bottom tab bar + sheets), the Settings sheet and the Exercise library of the new Overload UI on the foundation data layer, served at a temporary `/next.html` entry while the old app keeps shipping.

> **Revision 2026-10-17 (Apple-design audit, App Store target).** Changes from the 2026-10-09 draft: tabs move to a translucent bottom tab bar; Settings opens as a sheet with Done instead of acting as a hidden fourth tab; Manage exercises becomes the "Exercise library" view inside that sheet (with Back) instead of living in the Log placeholder; type sizes become `rem` tokens that honor the iOS text-size setting; motion, material and accessibility tokens (`prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`) are defined now so later animation work doesn't retrofit them; every pressable control gets an instant pressed state and hover only on hover-capable devices; segmented options reach 44px; delete-exercise confirmation states how many sessions it removes and can be cancelled; backup filenames use the local date (the draft used UTC); `next.html` gets per-scheme `theme-color`; the body font is the system font (San Francisco on Apple devices) instead of Inter. Engine behavior is unchanged in Plan A; the engine redesign gets its own spec before Plan B.

**Architecture:** React 19 + TypeScript. CSS variables (tokens) with CSS Modules; Zustand vanilla stores injected with a `KeyValueStore` so every test runs on an in-memory store. UI screens read/write only through store actions, which persist the whole `overload.v2` document and roll back on failure. The legacy `src/App.jsx`, `index.html` and the 62 foundation tests are untouched.

**Tech Stack:** React 19, TypeScript strict, Vite 6, Zustand, CSS Modules, system font (San Francisco on Apple devices) + JetBrains Mono, lucide-react, Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-09-design-system-and-shell-design.md` (this is Plan A of 3: A = design system/store/shell/Settings/Manage exercises; B = Log + rest timer + undo + UI-state persistence; C = Stats + History + e2e + cutover.)

## Global Constraints

- Dark tokens: bg `#0e1118`, surface `#161a24`, surface2 `#1d2230`, line `#222836`, text `#e9edf5`, accent `#3fd0c9`, on-accent `#04191a`. Light tokens: bg `#f6f4ef`, surface `#ffffff`, line `#e4e0d6`, text `#15181f`. The contrast test is authoritative for the remaining values; when it rejects a value, change the value, never the threshold, and say so in the commit.
- Contrast thresholds: 4.5:1 for body/small text, 3:1 for large numerals (≥24px, or ≥19px bold). No `font-size` below 13px (0.8125rem) in any CSS under `src/`; inputs never under 16px (`max(16px, var(--text-base))`).
- Font sizes in CSS Modules use the `--text-*` tokens (rem), never raw px, so the layout scales with the iPhone text-size setting.
- Tap targets ≥44px tall (`min-height: 44px`) for buttons, inputs, tabs and segmented options.
- Every pressable control has an `:active` pressed state that appears on touch-down (≤100ms, `--dur-press`). Hover styles live only inside `@media (hover: hover)` so they never stick after a tap on iOS.
- Motion uses the `--dur-*`/`--ease-*` tokens; under `prefers-reduced-motion: reduce` movement becomes a cross-fade (`--motion-offset: 0`), never a hard cut and never a slide.
- App Store target: the UI must read as a native iOS app (bottom tab bar, sheets with Done, no hidden pseudo-tabs). Platform calls that differ between browser and native (file download, haptics, notifications, storage) go through one small module each so the Capacitor wrap can swap them.
- Type: the platform system font (`-apple-system`/`system-ui`: San Francisco on iPhone and Mac, so it gets Apple's optical sizing and tracking for free; Segoe/Roboto elsewhere) with `font-variant-numeric: tabular-nums` on numerals; JetBrains Mono for set logs/timer. No body webfont is bundled.
- Theme preference is `settings.theme` ∈ `"system" | "dark" | "light"`; any other stored value (legacy `ember`, `slate`, `violet`, `paper`, or missing) is treated as `system` at read time and is not rewritten until the user changes it.
- Legacy keys `exercises`, `sessions`, `customGroups`, `settings` are never written. `overload.v2` is written only through `saveDoc` (whole document, one write). Transient UI state uses a separate key `overload.v2.ui`.
- Do not modify `src/App.jsx`, `index.html`, `src/storage.js`, `src/index.css` or the engine in `src/domain/progression.ts`.
- Gate for every task: `npm test && npm run typecheck && npm run lint` must pass before commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (shown as the second `-m`).
- Work on branch `rewrite`.

## Review Focus

1. **A failed save must roll back in-memory state and show an error**, never leave the UI showing data that was not stored — Tasks 5 and 6.
2. **A boot failure must never overwrite stored data**; the error screen's "Download raw data" must include `overload.v2` as well as the legacy keys — Task 6.
3. **Invalid settings input must never reach storage** (non-numeric, out of range, rep-low ≥ rep-high) and must explain itself — Tasks 3 and 7.
4. **Importing an invalid or wrong file leaves existing data intact; a valid file requires confirmation showing counts before it replaces anything** — Task 7.
5. **Legacy or unknown theme values must not crash or flash the wrong theme** — Task 2.

## File Structure

```
next.html                         temporary entry for the new UI (cutover is Plan C)
src/next/main.tsx                 renders <App kv={localStorage KV}/>
src/styles/tokens.css             design tokens, dark + light (colors, type, motion, material)
src/styles/a11y.css               reduced-motion, reduced-transparency, more-contrast overrides
src/styles/base.css               reset, typography, focus ring, touch behavior, safe areas
src/domain/theme.ts               ThemePref, themePreference()
src/domain/exercises.ts           allMuscleGroups, groupByMuscleFull, deleteExerciseCascade, addCustomGroup, sessionsWithExercise
src/state/appStore.ts             createAppStore(kv): doc + actions + persistence/rollback
src/state/uiStore.ts              createUiStore(kv): tab + open sheet (more in Plan B), key overload.v2.ui
src/state/context.tsx             StoreProvider, useApp, useUi, useKv
src/ui/*.tsx + *.module.css       Button, IconButton, Card, Input/Select/Field, NumberField, Segmented, TypeBadge, EmptyState, Sheet
src/app/App.tsx                   boot, theme apply, routing by tab
src/app/{Header,TabBar,ErrorScreen,ErrorBoundary,Banner}.tsx
src/app/{theme.ts,download.ts}    applyTheme, downloadText, backupFilename
src/features/settings/SettingsScreen.tsx
src/features/exercises/ExercisesManager.tsx
src/features/placeholders.tsx     temporary Log/Stats/History placeholders
tests/setup.ts, tests/helpers/{contrast.ts,blob.ts,renderWithStore.tsx}
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
- Produces: CSS variables `--bg --surface --surface2 --line --text --muted --accent --on-accent --warn --danger --on-danger` (+ `--accent-soft --warn-soft --danger-soft`, `--font-body --font-mono --radius --radius-sm`); type scale `--text-xs` (13) `--text-sm` (14) `--text-md` (15) `--text-base` (16) `--text-lg` (17) `--text-xl` (22) `--text-2xl` (28) `--text-3xl` (40) `--text-4xl` (64), in rem, with `--leading-tight --leading-snug` and `--tracking-tight --tracking-tighter`; motion `--dur-press --dur-fast --dur-sheet --ease-out --motion-offset`; material `--material --material-blur --scrim`; layout `--tabbar-h`; `type ThemePref = "system" | "dark" | "light"`; `themePreference(stored: string | undefined): ThemePref`; `applyTheme(pref: ThemePref, root?: HTMLElement): void`; `contrast(hexA: string, hexB: string): number`.

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
export type ThemePref = "system" | "dark" | "light";

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

### Task 3: UI primitives

**Files:**
- Create: `src/ui/Button.tsx`, `Button.module.css`, `IconButton.tsx`, `IconButton.module.css`, `Card.tsx`, `Card.module.css`, `Field.tsx`, `Field.module.css`, `NumberField.tsx`, `Segmented.tsx`, `Segmented.module.css`, `TypeBadge.tsx`, `TypeBadge.module.css`, `EmptyState.tsx`, `EmptyState.module.css`, `Sheet.tsx`, `Sheet.module.css`
- Test: `tests/ui/Button.test.tsx`, `tests/ui/NumberField.test.tsx`, `tests/ui/Segmented.test.tsx`, `tests/ui/primitives.test.tsx`, `tests/ui/Sheet.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant?: "primary"|"secondary"|"ghost"|"danger"; block?: boolean } & ButtonHTMLAttributes)`
  - `IconButton({ label: string; children: ReactNode } & ButtonHTMLAttributes)` (sets `aria-label` and `title` to `label`)
  - `Card({ title?: string; children: ReactNode })`
  - `Field({ label: string; htmlFor: string; error?: string | null; children: ReactNode })`, `Input` and `Select` (styled native elements, props pass through)
  - `NumberField({ label: string; value: number; min?: number; max?: number; onChange(v: number): void })` and `rangeMessage(min?, max?): string`
  - `Segmented<T extends string>({ label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void })`
  - `TypeBadge({ type: "compound" | "isolation" })`, `EmptyState({ text: string })`
  - `Sheet({ title: string; onClose(): void; onBack?: () => void; backLabel?: string; children: ReactNode })` — modal bottom sheet (`role="dialog"`, `aria-modal`), Done button and Escape close it, focus moves into it on open and back to the opener on close. The caller renders it only while open and marks the rest of the page `inert`.

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

`tests/ui/Segmented.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Segmented } from "../../src/ui/Segmented";

const options = [
  { value: "lb", label: "lb" },
  { value: "kg", label: "kg" },
] as const;

describe("Segmented", () => {
  it("exposes a radiogroup with the active option checked", () => {
    render(<Segmented label="Units" value="lb" options={[...options]} onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Units" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "lb" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "kg" })).toHaveAttribute("aria-checked", "false");
  });
  it("calls onChange with the chosen value", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Units" value="lb" options={[...options]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "kg" }));
    expect(onChange).toHaveBeenCalledWith("kg");
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
import { TypeBadge } from "../../src/ui/TypeBadge";

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
  it("TypeBadge names the exercise type", () => {
    const { rerender } = render(<TypeBadge type="compound" />);
    expect(screen.getByText("Compound")).toBeInTheDocument();
    rerender(<TypeBadge type="isolation" />);
    expect(screen.getByText("Isolation")).toBeInTheDocument();
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

- [ ] **Step 4: Implement `Card`, `Field`/`Input`/`Select`, `TypeBadge`, `EmptyState`**

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

`src/ui/TypeBadge.tsx`:
```tsx
import styles from "./TypeBadge.module.css";

export function TypeBadge({ type }: { type: "compound" | "isolation" }) {
  const compound = type === "compound";
  return <span className={[styles.badge, compound ? styles.compound : styles.isolation].join(" ")}>{compound ? "Compound" : "Isolation"}</span>;
}
```
`src/ui/TypeBadge.module.css`:
```css
.badge { display: inline-block; font-size: var(--text-xs); font-weight: 500; padding: 2px 8px; border-radius: 999px; }
.compound { color: var(--accent); background: var(--accent-soft); }
.isolation { color: var(--warn); background: var(--warn-soft); }
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

- [ ] **Step 5: Implement `NumberField` and `Segmented`**

`src/ui/NumberField.tsx`:
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

`src/ui/Segmented.tsx`:
```tsx
import styles from "./Segmented.module.css";

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={[styles.option, o.value === value ? styles.active : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```
`src/ui/Segmented.module.css`:
```css
.group { display: flex; gap: 4px; padding: 4px; background: var(--surface2); border-radius: var(--radius-sm); }
.option { flex: 1; min-height: 44px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font-size: var(--text-md); font-weight: 500; cursor: pointer; }
.active { background: var(--surface); color: var(--text); box-shadow: inset 0 0 0 1px var(--line); }
.option { transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out); }
.option:active:not(.active) { background: var(--accent-soft); }
```

`tests/ui/Sheet.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "../../src/ui/Sheet";

describe("Sheet", () => {
  it("is a labelled modal dialog that takes focus", () => {
    render(<Sheet title="Settings" onClose={() => {}}>body</Sheet>);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });
  it("closes on Done and on Escape", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Settings" onClose={onClose}>body</Sheet>);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it("shows a Back button only when onBack is given", async () => {
    const onBack = vi.fn();
    const { rerender } = render(<Sheet title="Exercises" onClose={() => {}}>x</Sheet>);
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    rerender(<Sheet title="Exercises" onClose={() => {}} onBack={onBack} backLabel="Settings">x</Sheet>);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it("returns focus to the opener when it unmounts", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<Sheet title="Settings" onClose={() => {}}>x</Sheet>);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
```

`src/ui/Sheet.tsx`:
```tsx
import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./Sheet.module.css";

export interface SheetProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}

// Modal bottom sheet, iOS style: rises from the bottom edge, Done top-right, optional Back top-left.
// Drag-to-dismiss and spring motion come with the gestures sub-project.
export function Sheet({ title, onClose, onBack, backLabel = "Back", children }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus();
  }, []);

  return (
    <div className={styles.layer}>
      <div className={styles.scrim} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.sheet}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <header className={styles.bar}>
          <div className={styles.side}>
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                <ChevronLeft size={20} aria-hidden />
                {backLabel}
              </Button>
            )}
          </div>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <div className={[styles.side, styles.end].join(" ")}>
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </div>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
```
`src/ui/Sheet.module.css`:
```css
.layer { position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center; }
.scrim { position: absolute; inset: 0; background: var(--scrim); animation: fade var(--dur-sheet) var(--ease-out); }
.sheet {
  position: relative; width: 100%; max-width: 720px;
  max-height: calc(100% - env(safe-area-inset-top) - 12px);
  display: flex; flex-direction: column;
  background: var(--bg); border-radius: var(--radius) var(--radius) 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.28);
  animation: rise var(--dur-sheet) var(--ease-out);
  outline: none;
}
.bar {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  min-height: 56px; padding: 0 8px; border-bottom: 1px solid var(--line);
}
.side { display: flex; }
.end { justify-content: flex-end; }
.title { font-size: var(--text-lg); font-weight: 600; }
.body {
  overflow-y: auto; overscroll-behavior: contain;
  padding: 16px max(16px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}
/* Travel scales with --motion-offset, so reduced motion turns the rise into a fade. */
@keyframes rise {
  from { transform: translateY(calc(40px * var(--motion-offset))); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (the typography-floor test also scans the new CSS: all sizes ≥13px).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ui): add Button, Card, Field, NumberField, Segmented, Sheet and badges" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 4: Exercise domain helpers

**Files:**
- Create: `src/domain/exercises.ts`, `tests/domain/exercises.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `StoreDoc` types.
- Produces:
  - `MUSCLE_GROUPS: string[]` (`Chest, Back, Shoulders, Legs, Arms, Core`)
  - `allMuscleGroups(exercises: Exercise[], customGroups?: string[]): string[]` (fixed + custom + groups used by exercises, deduped, in that order)
  - `groupByMuscle(exercises): Record<string, Exercise[]>` and `groupByMuscleFull(allGroups: string[], exercises): Record<string, Exercise[]>` (missing group → `"Other"`)
  - `deleteExerciseCascade(doc: StoreDoc, id: string): StoreDoc`
  - `type AddGroupResult = "added" | "empty" | "duplicate"`; `addCustomGroup(doc: StoreDoc, name: string): { doc: StoreDoc; result: AddGroupResult }`
  - `sessionsWithExercise(doc: StoreDoc, id: string): number` (how many logged sessions a delete would touch; shown in the delete confirmation)

- [ ] **Step 1: Write the failing test `tests/domain/exercises.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { emptyDoc } from "../../src/data/store";
import {
  MUSCLE_GROUPS, addCustomGroup, allMuscleGroups, deleteExerciseCascade, groupByMuscle, groupByMuscleFull, sessionsWithExercise,
} from "../../src/domain/exercises";
import type { Exercise, StoreDoc } from "../../src/domain/types";

const ex = (id: string, group: string, type: "compound" | "isolation" = "compound"): Exercise => ({ id, name: id, type, muscleGroup: group });

function docWith(): StoreDoc {
  return {
    ...emptyDoc(),
    exercises: [ex("bench", "Chest"), ex("curl", "Arms", "isolation")],
    customGroups: ["Neck"],
    sessions: [
      { id: "s1", date: "2026-01-01", name: "A", blocks: [{ id: "b1", exerciseId: "bench", sets: [] }, { id: "b2", exerciseId: "curl", sets: [] }] },
      { id: "s2", date: "2026-01-02", name: "B", blocks: [{ id: "b3", exerciseId: "bench", sets: [] }] },
    ],
  };
}

describe("allMuscleGroups", () => {
  it("unions fixed, custom and used groups without duplicates", () => {
    const groups = allMuscleGroups([ex("a", "Forearms"), ex("b", "Chest")], ["Neck", "Chest"]);
    expect(groups.slice(0, MUSCLE_GROUPS.length)).toEqual(MUSCLE_GROUPS);
    expect(groups).toContain("Neck");
    expect(groups).toContain("Forearms");
    expect(new Set(groups).size).toBe(groups.length);
  });
});

describe("grouping", () => {
  it("buckets exercises without a group as Other", () => {
    expect(groupByMuscle([ex("a", "")])["Other"]).toHaveLength(1);
  });
  it("groupByMuscleFull keeps empty groups", () => {
    const map = groupByMuscleFull(["Chest", "Neck"], [ex("bench", "Chest")]);
    expect(map["Chest"]).toHaveLength(1);
    expect(map["Neck"]).toEqual([]);
  });
});

describe("deleteExerciseCascade", () => {
  it("removes the exercise, its blocks, and sessions left empty", () => {
    const next = deleteExerciseCascade(docWith(), "bench");
    expect(next.exercises.map((e) => e.id)).toEqual(["curl"]);
    expect(next.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(next.sessions[0]!.blocks.map((b) => b.id)).toEqual(["b2"]);
  });
  it("does not mutate the input", () => {
    const doc = docWith();
    deleteExerciseCascade(doc, "bench");
    expect(doc.exercises).toHaveLength(2);
    expect(doc.sessions).toHaveLength(2);
  });
});

describe("sessionsWithExercise", () => {
  it("counts sessions containing the exercise", () => {
    expect(sessionsWithExercise(docWith(), "bench")).toBe(2);
    expect(sessionsWithExercise(docWith(), "curl")).toBe(1);
    expect(sessionsWithExercise(docWith(), "nope")).toBe(0);
  });
});

describe("addCustomGroup", () => {
  it("adds a trimmed new group", () => {
    const r = addCustomGroup(docWith(), "  Forearms ");
    expect(r.result).toBe("added");
    expect(r.doc.customGroups).toEqual(["Neck", "Forearms"]);
  });
  it("rejects blank names", () => {
    const doc = docWith();
    const r = addCustomGroup(doc, "   ");
    expect(r.result).toBe("empty");
    expect(r.doc).toBe(doc);
  });
  it("rejects case-insensitive duplicates of fixed, custom and used groups", () => {
    for (const name of ["chest", "NECK", "arms"]) {
      expect(addCustomGroup(docWith(), name).result).toBe("duplicate");
    }
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/domain/exercises.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/domain/exercises.ts`**

```ts
import type { Exercise, StoreDoc } from "./types";

export const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core"];

export function allMuscleGroups(exercises: Exercise[], customGroups: string[] = []): string[] {
  const used = exercises.map((e) => e.muscleGroup).filter(Boolean);
  return Array.from(new Set([...MUSCLE_GROUPS, ...customGroups, ...used]));
}

export function groupByMuscle(exercises: Exercise[]): Record<string, Exercise[]> {
  const map: Record<string, Exercise[]> = {};
  exercises.forEach((e) => {
    (map[e.muscleGroup || "Other"] ??= []).push(e);
  });
  return map;
}

export function groupByMuscleFull(allGroups: string[], exercises: Exercise[]): Record<string, Exercise[]> {
  const map: Record<string, Exercise[]> = {};
  allGroups.forEach((g) => (map[g] = []));
  exercises.forEach((e) => {
    (map[e.muscleGroup || "Other"] ??= []).push(e);
  });
  return map;
}

/** Removes the exercise and all of its blocks; sessions left with no blocks are removed too. */
export function deleteExerciseCascade(doc: StoreDoc, id: string): StoreDoc {
  return {
    ...doc,
    exercises: doc.exercises.filter((e) => e.id !== id),
    sessions: doc.sessions
      .map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.exerciseId !== id) }))
      .filter((s) => s.blocks.length > 0),
  };
}

export function sessionsWithExercise(doc: StoreDoc, id: string): number {
  return doc.sessions.filter((s) => s.blocks.some((b) => b.exerciseId === id)).length;
}

export type AddGroupResult = "added" | "empty" | "duplicate";

export function addCustomGroup(doc: StoreDoc, name: string): { doc: StoreDoc; result: AddGroupResult } {
  const trimmed = name.trim();
  if (!trimmed) return { doc, result: "empty" };
  const existing = allMuscleGroups(doc.exercises, doc.customGroups).map((g) => g.toLowerCase());
  if (existing.includes(trimmed.toLowerCase())) return { doc, result: "duplicate" };
  return { doc: { ...doc, customGroups: [...doc.customGroups, trimmed] }, result: "added" };
}
```

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(domain): add exercise grouping, cascade delete, usage count and custom-group helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: App store and UI store

**Files:**
- Create: `src/state/appStore.ts`, `src/state/uiStore.ts`, `tests/helpers/seed.ts`, `tests/state/appStore.test.ts`, `tests/state/uiStore.test.ts`

**Interfaces:**
- Consumes: `KeyValueStore`, `bootStore`, `saveDoc`, `emptyDoc`, `StoreDoc`, `Settings`, `Exercise`, `deleteExerciseCascade`, `addCustomGroup`, `AddGroupResult`.
- Produces:
  - `createAppStore(kv: KeyValueStore): StoreApi<AppState>` with
    ```ts
    interface AppState {
      status: "loading" | "ready" | "error";
      error: string | null;
      bootKind: "v2" | "migrated" | "fresh" | null;
      warnings: string[];
      doc: StoreDoc;
      saveError: string | null;
      init(): Promise<void>;                       // idempotent: repeated calls share one boot
      updateSettings(fn: (s: Settings) => Settings): Promise<boolean>;
      updateExercise(id: string, patch: Partial<Pick<Exercise, "name" | "muscleGroup" | "type">>): Promise<boolean>;
      deleteExercise(id: string): Promise<boolean>;
      addGroup(name: string): Promise<AddGroupResult | "failed">;
      replaceDoc(doc: StoreDoc): Promise<boolean>;
      dismissSaveError(): void;
    }
    ```
    Every mutating action updates `doc` immediately, then persists via `saveDoc`; on a write error it restores the previous `doc`, sets `saveError` (`"Couldn't save: <message>"`) and returns `false`/`"failed"`.
  - `UI_KEY = "overload.v2.ui"`, `type Tab = "log" | "stats" | "history"`, `type SheetId = "settings" | "exercises"`, `createUiStore(kv): StoreApi<UiState>` with `{ tab: Tab; sheet: SheetId | null; setTab(t: Tab): void; openSheet(s: SheetId): void; closeSheet(): void; hydrate(): Promise<void> }`. Persisted JSON: `{ version: 1, tab }` (an open sheet is not persisted; a reload lands on the tab). All UI-state I/O errors are swallowed (transient state must never block the app).
  - Test helper `seedLegacy(b: BackupV1): ReturnType<typeof createMemoryKV>` (the four legacy keys).

- [ ] **Step 1: Write the failing tests**

`tests/helpers/seed.ts`:
```ts
import { createMemoryKV } from "../../src/data/kv";
import type { BackupV1 } from "./fixtures";

export function seedLegacy(b: BackupV1) {
  return createMemoryKV({
    exercises: JSON.stringify(b.exercises),
    sessions: JSON.stringify(b.sessions),
    customGroups: JSON.stringify(b.customGroups),
    settings: JSON.stringify(b.settings),
  });
}
```

`tests/state/appStore.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { createAppStore } from "../../src/state/appStore";
import { syntheticBackup } from "../helpers/fixtures";
import { seedLegacy } from "../helpers/seed";

function stored(kv: { dump(): Record<string, string> }) {
  return JSON.parse(kv.dump()[V2_KEY]!);
}

async function ready() {
  const kv = seedLegacy(syntheticBackup());
  let failWrites = false;
  const wrapped: KeyValueStore = {
    get: kv.get,
    set: async (k, v) => {
      if (failWrites) throw new Error("QuotaExceededError");
      await kv.set(k, v);
    },
  };
  const store = createAppStore(wrapped);
  await store.getState().init();
  return { kv, store, failNext: () => (failWrites = true) };
}

describe("init", () => {
  it("migrates legacy data and becomes ready", async () => {
    const { kv, store } = await ready();
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.bootKind).toBe("migrated");
    expect(s.doc.exercises).toHaveLength(syntheticBackup().exercises.length);
    expect(stored(kv).schemaVersion).toBe(2);
  });

  it("is idempotent: a second init does not re-boot or downgrade bootKind", async () => {
    const { store } = await ready();
    await store.getState().init();
    expect(store.getState().bootKind).toBe("migrated");
  });

  it("goes to error state on a corrupt v2 document and does not overwrite it", async () => {
    const kv = seedLegacy(syntheticBackup());
    await kv.set(V2_KEY, "{corrupt");
    const store = createAppStore(kv);
    await store.getState().init();
    expect(store.getState().status).toBe("error");
    expect(store.getState().error).toMatch(/overload\.v2/);
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });
});

describe("actions", () => {
  it("updateSettings persists the change", async () => {
    const { kv, store } = await ready();
    expect(await store.getState().updateSettings((s) => ({ ...s, unit: "kg", increment: 2.5 }))).toBe(true);
    expect(store.getState().doc.settings.unit).toBe("kg");
    expect(stored(kv).settings).toMatchObject({ unit: "kg", increment: 2.5 });
  });

  it("rolls back and reports when the write fails", async () => {
    const { store, failNext } = await ready();
    failNext();
    const before = store.getState().doc.settings.unit;
    expect(await store.getState().updateSettings((s) => ({ ...s, unit: "kg" }))).toBe(false);
    expect(store.getState().doc.settings.unit).toBe(before);
    expect(store.getState().saveError).toMatch(/Couldn't save: QuotaExceededError/);
    store.getState().dismissSaveError();
    expect(store.getState().saveError).toBeNull();
  });

  it("updateExercise merges a patch and persists", async () => {
    const { kv, store } = await ready();
    await store.getState().updateExercise("ex-iso", { name: "Hammer Curl", type: "compound" });
    const e = store.getState().doc.exercises.find((x) => x.id === "ex-iso")!;
    expect(e).toMatchObject({ name: "Hammer Curl", type: "compound", muscleGroup: "Arms" });
    expect(stored(kv).exercises.find((x: { id: string }) => x.id === "ex-iso").name).toBe("Hammer Curl");
  });

  it("deleteExercise cascades into sessions and persists", async () => {
    const { kv, store } = await ready();
    await store.getState().deleteExercise("ex-blow");
    const doc = store.getState().doc;
    expect(doc.exercises.some((e) => e.id === "ex-blow")).toBe(false);
    expect(doc.sessions.flatMap((s) => s.blocks).some((b) => b.exerciseId === "ex-blow")).toBe(false);
    expect(stored(kv).sessions).toEqual(doc.sessions);
  });

  it("addGroup reports added / empty / duplicate and writes only on added", async () => {
    const { kv, store } = await ready();
    const before = kv.dump()[V2_KEY];
    expect(await store.getState().addGroup("  ")).toBe("empty");
    expect(await store.getState().addGroup("chest")).toBe("duplicate");
    expect(kv.dump()[V2_KEY]).toBe(before);
    expect(await store.getState().addGroup("Forearms")).toBe("added");
    expect(store.getState().doc.customGroups).toContain("Forearms");
    expect(stored(kv).customGroups).toContain("Forearms");
  });

  it("replaceDoc swaps the whole document and persists", async () => {
    const { kv, store } = await ready();
    const next = { ...store.getState().doc, exercises: [], sessions: [], customGroups: [] };
    expect(await store.getState().replaceDoc(next)).toBe(true);
    expect(stored(kv).exercises).toEqual([]);
  });
});
```

`tests/state/uiStore.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createMemoryKV } from "../../src/data/kv";
import { UI_KEY, createUiStore } from "../../src/state/uiStore";

describe("uiStore", () => {
  it("defaults to the log tab", async () => {
    const store = createUiStore(createMemoryKV());
    await store.getState().hydrate();
    expect(store.getState().tab).toBe("log");
  });

  it("persists the tab and restores it on the next hydrate", async () => {
    const kv = createMemoryKV();
    const a = createUiStore(kv);
    a.getState().setTab("history");
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(kv.dump()[UI_KEY]!)).toEqual({ version: 1, tab: "history" });
    const b = createUiStore(kv);
    await b.getState().hydrate();
    expect(b.getState().tab).toBe("history");
  });

  it("falls back to log for corrupt or unknown stored state", async () => {
    for (const raw of ["{nope", JSON.stringify({ version: 1, tab: "bogus" }), JSON.stringify({ version: 1, tab: "settings" }), "null"]) {
      const store = createUiStore(createMemoryKV({ [UI_KEY]: raw }));
      await store.getState().hydrate();
      expect(store.getState().tab).toBe("log");
    }
  });

  it("opens and closes sheets without persisting them", async () => {
    const kv = createMemoryKV();
    const store = createUiStore(kv);
    store.getState().openSheet("settings");
    expect(store.getState().sheet).toBe("settings");
    store.getState().openSheet("exercises");
    expect(store.getState().sheet).toBe("exercises");
    store.getState().closeSheet();
    expect(store.getState().sheet).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(kv.dump()[UI_KEY]).toBeUndefined();
  });

  it("never throws when storage fails", async () => {
    const failing = { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } };
    const store = createUiStore(failing);
    await expect(store.getState().hydrate()).resolves.toBeUndefined();
    store.getState().setTab("stats");
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().tab).toBe("stats");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/state`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/state/appStore.ts`**

```ts
import { createStore, type StoreApi } from "zustand/vanilla";
import { bootStore } from "../data/boot";
import type { KeyValueStore } from "../data/kv";
import { emptyDoc, saveDoc } from "../data/store";
import { addCustomGroup, deleteExerciseCascade, type AddGroupResult } from "../domain/exercises";
import type { Exercise, Settings, StoreDoc } from "../domain/types";

export interface AppState {
  status: "loading" | "ready" | "error";
  error: string | null;
  bootKind: "v2" | "migrated" | "fresh" | null;
  warnings: string[];
  doc: StoreDoc;
  saveError: string | null;
  init(): Promise<void>;
  updateSettings(fn: (s: Settings) => Settings): Promise<boolean>;
  updateExercise(id: string, patch: Partial<Pick<Exercise, "name" | "muscleGroup" | "type">>): Promise<boolean>;
  deleteExercise(id: string): Promise<boolean>;
  addGroup(name: string): Promise<AddGroupResult | "failed">;
  replaceDoc(doc: StoreDoc): Promise<boolean>;
  dismissSaveError(): void;
}

export type AppStore = StoreApi<AppState>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createAppStore(kv: KeyValueStore): AppStore {
  let booting: Promise<void> | null = null;

  return createStore<AppState>()((set, get) => {
    // Update the UI immediately, then write once; restore the previous doc if the write fails.
    async function persist(next: StoreDoc): Promise<boolean> {
      const prev = get().doc;
      set({ doc: next, saveError: null });
      try {
        await saveDoc(kv, next);
        return true;
      } catch (e) {
        set({ doc: prev, saveError: `Couldn't save: ${message(e)}` });
        return false;
      }
    }

    return {
      status: "loading",
      error: null,
      bootKind: null,
      warnings: [],
      doc: emptyDoc(),
      saveError: null,

      init() {
        booting ??= (async () => {
          try {
            const r = await bootStore(kv);
            set({ status: "ready", doc: r.doc, bootKind: r.kind, warnings: r.warnings });
          } catch (e) {
            set({ status: "error", error: message(e) });
          }
        })();
        return booting;
      },

      updateSettings: (fn) => persist({ ...get().doc, settings: fn(get().doc.settings) }),

      updateExercise: (id, patch) =>
        persist({ ...get().doc, exercises: get().doc.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),

      deleteExercise: (id) => persist(deleteExerciseCascade(get().doc, id)),

      async addGroup(name) {
        const { doc, result } = addCustomGroup(get().doc, name);
        if (result !== "added") return result;
        return (await persist(doc)) ? "added" : "failed";
      },

      replaceDoc: (doc) => persist(doc),

      dismissSaveError: () => set({ saveError: null }),
    };
  });
}
```

- [ ] **Step 4: Implement `src/state/uiStore.ts`**

```ts
import { createStore, type StoreApi } from "zustand/vanilla";
import type { KeyValueStore } from "../data/kv";

export const UI_KEY = "overload.v2.ui";
export type Tab = "log" | "stats" | "history";
const TABS: readonly Tab[] = ["log", "stats", "history"];
export type SheetId = "settings" | "exercises";

export interface UiState {
  tab: Tab;
  sheet: SheetId | null;
  setTab(tab: Tab): void;
  openSheet(sheet: SheetId): void;
  closeSheet(): void;
  hydrate(): Promise<void>;
}

export type UiStore = StoreApi<UiState>;

// Transient UI state: failures here must never block the app, so all I/O errors are swallowed.
export function createUiStore(kv: KeyValueStore): UiStore {
  return createStore<UiState>()((set, get) => {
    function save() {
      void kv.set(UI_KEY, JSON.stringify({ version: 1, tab: get().tab })).catch(() => {});
    }
    return {
      tab: "log",
      sheet: null,
      setTab(tab) {
        set({ tab });
        save();
      },
      openSheet: (sheet) => set({ sheet }),
      closeSheet: () => set({ sheet: null }),
      async hydrate() {
        try {
          const raw = await kv.get(UI_KEY);
          if (raw === null) return;
          const parsed: unknown = JSON.parse(raw);
          const tab = (parsed as { tab?: unknown } | null)?.tab;
          if (typeof tab === "string" && (TABS as readonly string[]).includes(tab)) set({ tab: tab as Tab });
        } catch {
          /* corrupt or unavailable: keep defaults */
        }
      },
    };
  });
}
```

- [ ] **Step 5: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(state): add app store with rollback-on-failure and ui store" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App shell, error handling and migration banner

**Files:**
- Create: `src/state/context.tsx`, `src/app/Shell.tsx`, `Shell.module.css`, `Header.tsx`, `Header.module.css`, `TabBar.tsx`, `TabBar.module.css`, `ErrorBoundary.tsx`, `ErrorScreen.tsx`, `Banner.tsx`, `Banner.module.css`, `download.ts`, `src/features/placeholders.tsx`, `tests/helpers/blob.ts`, `tests/helpers/renderWithStore.tsx`, `tests/app/shell.test.tsx`, `tests/app/download.test.ts`
- Modify: `src/app/App.tsx` (replace stub), `src/data/boot.ts` (add `dumpRaw`), `tests/data/boot.test.ts` (add one test)

**Interfaces:**
- Consumes: `createAppStore`, `createUiStore`, `exportBackup`, `applyTheme`, `themePreference`, `bootStore`.
- Produces:
  - `dumpRaw(kv): Promise<Record<string,string>>` — legacy keys **plus** `overload.v2` when present
  - `downloadText(filename: string, text: string, mime?: string): void` (the one place a file leaves the app; the native wrap swaps it for the iOS share sheet) and `backupFilename(now?: Date): string` → `overload-backup-YYYY-MM-DD.json` from **local** date parts
  - `StoreProvider({ value: { app: AppStore; ui: UiStore; kv: KeyValueStore }, children })`, hooks `useApp(selector)`, `useUi(selector)`, `useKv()`, `useAppStore()`
  - `Shell()` (reads stores from context), `App({ kv })` (creates stores, hydrates, boots)
  - Test helper `renderWithStore(ui, opts?)` → `{ ...renderResult, kv, app, uiStore, user }` (`opts.legacy` defaults to `syntheticBackup()`, `opts.kv` overrides, `opts.init` default true)

- [ ] **Step 1: Write failing tests**

Append to `tests/data/boot.test.ts` (new `it` inside `describe("boot edge cases", ...)`, plus add `dumpRaw` to the existing import from `../../src/data/boot`):
```ts
  it("dumpRaw includes overload.v2 as well as legacy keys", async () => {
    const kv = createMemoryKV({ exercises: "[1]", [V2_KEY]: "{corrupt" });
    expect(await dumpRaw(kv)).toEqual({ exercises: "[1]", [V2_KEY]: "{corrupt" });
  });
```

`tests/helpers/blob.ts`:
```ts
export function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });
}
```

`tests/helpers/renderWithStore.tsx`:
```tsx
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createMemoryKV } from "../../src/data/kv";
import { createAppStore } from "../../src/state/appStore";
import { StoreProvider } from "../../src/state/context";
import { createUiStore } from "../../src/state/uiStore";
import { syntheticBackup, type BackupV1 } from "./fixtures";
import { seedLegacy } from "./seed";

export async function renderWithStore(
  element: ReactElement,
  opts: { legacy?: BackupV1; kv?: ReturnType<typeof createMemoryKV>; init?: boolean } = {},
) {
  const kv = opts.kv ?? seedLegacy(opts.legacy ?? syntheticBackup());
  const app = createAppStore(kv);
  const uiStore = createUiStore(kv);
  if (opts.init !== false) {
    await uiStore.getState().hydrate();
    await app.getState().init();
  }
  const utils = render(<StoreProvider value={{ app, ui: uiStore, kv }}>{element}</StoreProvider>);
  return { ...utils, kv, app, uiStore, user: userEvent.setup() };
}
```

`tests/app/download.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { backupFilename, downloadText } from "../../src/app/download";
import { blobText } from "../helpers/blob";

afterEach(() => vi.restoreAllMocks());

describe("downloadText", () => {
  it("creates a blob URL, clicks a download anchor with the filename, and revokes the URL", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      created.push(b as Blob);
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    let name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    downloadText("a.json", '{"ok":true}');
    expect(name).toBe("a.json");
    expect(await blobText(created[0]!)).toBe('{"ok":true}');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });
});

describe("backupFilename", () => {
  it("uses the local calendar date, not UTC (a late-evening export keeps today's date)", () => {
    expect(backupFilename(new Date(2026, 9, 17, 23, 45))).toBe("overload-backup-2026-10-17.json");
    expect(backupFilename(new Date(2026, 0, 2, 0, 15))).toBe("overload-backup-2026-01-02.json");
  });
});
```

`tests/app/shell.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { App } from "../../src/app/App";
import { ErrorBoundary } from "../../src/app/ErrorBoundary";
import { Shell } from "../../src/app/Shell";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { UI_KEY } from "../../src/state/uiStore";
import { syntheticBackup } from "../helpers/fixtures";
import { renderWithStore } from "../helpers/renderWithStore";
import { seedLegacy } from "../helpers/seed";

const download = vi.hoisted(() => vi.fn());
vi.mock("../../src/app/download", async (orig) => ({ ...(await orig<object>()), downloadText: download }));

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  download.mockClear();
});

describe("Shell", () => {
  it("shows the header, a bottom tab bar with three tabs and a settings button once ready", async () => {
    await renderWithStore(<Shell />);
    expect(screen.getByRole("heading", { name: "Overload" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Sections" }).closest("nav")).toHaveClass("tabbar");
    expect(screen.getByRole("tab", { name: "Log" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("switches tabs and persists the choice", async () => {
    const { user, kv } = await renderWithStore(<Shell />);
    await user.click(screen.getByRole("tab", { name: "Stats" }));
    expect(screen.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(JSON.parse(kv.dump()[UI_KEY]!).tab).toBe("stats"));
  });

  it("the gear opens Settings as a sheet over the current tab; Done closes it and returns focus", async () => {
    const { user } = await renderWithStore(<Shell />);
    await user.click(screen.getByRole("tab", { name: "History" }));
    const gear = screen.getByRole("button", { name: "Settings" });
    await user.click(gear);
    const sheet = screen.getByRole("dialog", { name: "Settings" });
    expect(sheet).toBeInTheDocument();
    expect(document.querySelector("[data-shell-content]")).toHaveAttribute("inert");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[data-shell-content]")).not.toHaveAttribute("inert");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(gear).toHaveFocus();
  });

  it("restores the last tab from a previous session", async () => {
    const kv = seedLegacy(syntheticBackup());
    await kv.set(UI_KEY, JSON.stringify({ version: 1, tab: "history" }));
    await renderWithStore(<Shell />, { kv });
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the migration banner after copying legacy data and lets the user dismiss it", async () => {
    const { user } = await renderWithStore(<Shell />);
    expect(screen.getByText(/Your data was copied/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Your data was copied/)).toBeNull();
  });

  it("offers a v2 backup download from the banner", async () => {
    const { user } = await renderWithStore(<Shell />);
    await user.click(screen.getByRole("button", { name: "Download backup" }));
    expect(download).toHaveBeenCalledTimes(1);
    const [filename, text] = download.mock.calls[0]!;
    expect(filename).toMatch(/^overload-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(text)).toMatchObject({ app: "overload", version: 2 });
  });

  it("applies a stored dark/light preference and treats legacy themes as system", async () => {
    const light = { ...syntheticBackup(), settings: { ...syntheticBackup().settings, theme: "light" } };
    await renderWithStore(<Shell />, { legacy: light });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    document.documentElement.removeAttribute("data-theme");
    const legacy = { ...syntheticBackup(), settings: { ...syntheticBackup().settings, theme: "violet" } };
    await renderWithStore(<Shell />, { legacy });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("shows a dismissible alert when a save fails and the screen keeps the stored data", async () => {
    const inner = seedLegacy(syntheticBackup());
    let fail = false;
    const kv = {
      get: inner.get,
      set: async (k: string, v: string) => {
        if (fail) throw new Error("QuotaExceededError");
        await inner.set(k, v);
      },
      dump: inner.dump,
    };
    const { app, user } = await renderWithStore(<Shell />, { kv });
    fail = true;
    await app.getState().updateSettings((s) => ({ ...s, unit: "kg" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save: QuotaExceededError");
    await user.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(screen.queryByText(/Couldn't save/)).toBeNull();
    expect(JSON.parse(inner.dump()[V2_KEY]!).settings.unit).toBe("lb");
  });
});

describe("boot failure", () => {
  it("shows the error and a raw-data download that includes overload.v2", async () => {
    const kv = seedLegacy(syntheticBackup());
    await kv.set(V2_KEY, "{corrupt");
    render(<App kv={kv} />);
    expect(await screen.findByText(/overload\.v2/)).toBeInTheDocument();
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Download raw data" }));
    const [filename, text] = download.mock.calls[0]!;
    expect(filename).toBe("overload-raw.json");
    expect(JSON.parse(text)[V2_KEY]).toBe("{corrupt");
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });
});

describe("App", () => {
  it("boots from legacy data end to end", async () => {
    const kv = seedLegacy(syntheticBackup());
    render(<App kv={kv} />);
    expect(await screen.findByRole("heading", { name: "Overload" })).toBeInTheDocument();
    expect(kv.dump()[V2_KEY]).toBeDefined();
  });

  it("survives StrictMode-style double effects without losing the migration banner", async () => {
    const kv = createMemoryKV(seedLegacy(syntheticBackup()).dump());
    const { StrictMode } = await import("react");
    render(
      <StrictMode>
        <App kv={kv} />
      </StrictMode>,
    );
    expect(await screen.findByText(/Your data was copied/)).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  it("renders a recoverable screen with the error message instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("kaboom");
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/app tests/data/boot.test.ts`
Expected: FAIL — modules missing (`Shell`, `ErrorBoundary`, `download`, `context`, `dumpRaw`).

- [ ] **Step 3: Add `dumpRaw` to `src/data/boot.ts`**

Add import `import { V2_KEY, emptyDoc, loadDoc, saveDoc } from "./store";` (extend the existing store import) and append:
```ts
/** Everything stored, raw: legacy keys plus overload.v2. For the error-screen escape hatch. */
export async function dumpRaw(kv: KeyValueStore): Promise<Record<string, string>> {
  const out = await dumpLegacyRaw(kv);
  const v2 = await kv.get(V2_KEY);
  if (v2 !== null) out[V2_KEY] = v2;
  return out;
}
```

- [ ] **Step 4: Implement `src/app/download.ts` and `src/state/context.tsx`**

`src/app/download.ts`:
```ts
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Backup filename from local calendar parts (never UTC), matching how sessions are dated. */
export function backupFilename(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `overload-backup-${now.getFullYear()}-${mm}-${dd}.json`;
}
```

`src/state/context.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { KeyValueStore } from "../data/kv";
import type { AppState, AppStore } from "./appStore";
import type { UiState, UiStore } from "./uiStore";

interface Stores {
  app: AppStore;
  ui: UiStore;
  kv: KeyValueStore;
}

const Ctx = createContext<Stores | null>(null);

export function StoreProvider({ value, children }: { value: Stores; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useStores(): Stores {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider is missing");
  return v;
}

export const useApp = <T,>(selector: (s: AppState) => T): T => useStore(useStores().app, selector);
export const useUi = <T,>(selector: (s: UiState) => T): T => useStore(useStores().ui, selector);
export const useKv = (): KeyValueStore => useStores().kv;
export const useAppStore = (): AppStore => useStores().app;
```

- [ ] **Step 5: Implement the shell pieces**

`src/features/placeholders.tsx`:
```tsx
import { EmptyState } from "../ui/EmptyState";

export const LogPlaceholder = () => <EmptyState text="Logging arrives in Plan B." />;
export const StatsPlaceholder = () => <EmptyState text="Stats arrive in Plan C." />;
export const HistoryPlaceholder = () => <EmptyState text="History arrives in Plan C." />;
export const SettingsPlaceholder = () => <EmptyState text="Settings arrive in Task 7." />;
```

`src/app/ErrorBoundary.tsx`:
```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";

// Catches render errors so a crash shows a recoverable screen instead of a blank page.
// Data is stored on the device, so a reload recovers.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Overload crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 22 }}>Something broke</h1>
        <p style={{ color: "var(--muted)", margin: "8px 0 16px" }}>
          Your logged data is safe — it&apos;s stored on this device. Reload to get back in.
        </p>
        <Button variant="primary" block onClick={() => window.location.reload()}>
          Reload
        </Button>
        <pre style={{ marginTop: 16, textAlign: "left", fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap" }}>
          {String(this.state.error.message || this.state.error)}
        </pre>
      </div>
    );
  }
}
```

`src/app/ErrorScreen.tsx`:
```tsx
import { Button } from "../ui/Button";

export function ErrorScreen({ message, onDownloadRaw }: { message: string; onDownloadRaw: () => void }) {
  return (
    <main style={{ padding: 24, maxWidth: 560, margin: "40px auto" }}>
      <h1 style={{ fontSize: 22 }}>Couldn&apos;t read your data</h1>
      <p style={{ color: "var(--muted)", margin: "8px 0 16px" }}>
        Nothing was changed or deleted. You can save exactly what is stored on this device.
      </p>
      <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", marginBottom: 16 }}>{message}</pre>
      <Button variant="primary" block onClick={onDownloadRaw}>
        Download raw data
      </Button>
    </main>
  );
}
```

`src/app/Banner.tsx`:
```tsx
import type { ReactNode } from "react";
import styles from "./Banner.module.css";

export function Banner({ tone = "info", role, children }: { tone?: "info" | "error"; role?: "alert"; children: ReactNode }) {
  return (
    <div role={role} className={[styles.banner, tone === "error" ? styles.error : ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
```
`src/app/Banner.module.css`:
```css
.banner { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 12px 16px; margin-bottom: 16px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--text); font-size: var(--text-md); }
.error { background: var(--danger-soft); }
```

`src/app/Header.tsx`:
```tsx
import { Dumbbell, Settings as SettingsIcon } from "lucide-react";
import { IconButton } from "../ui/IconButton";
import styles from "./Header.module.css";

export function Header({ onSettings }: { onSettings: () => void }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Dumbbell size={22} color="var(--accent)" aria-hidden />
          <h1 className={styles.title}>Overload</h1>
        </div>
        <IconButton label="Settings" onClick={onSettings}>
          <SettingsIcon size={22} />
        </IconButton>
      </div>
    </header>
  );
}
```
`src/app/Header.module.css`:
```css
.header { padding-top: env(safe-area-inset-top); }
.inner { max-width: 720px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px max(8px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
.brand { display: flex; align-items: center; gap: 10px; }
.title { font-size: var(--text-2xl); font-weight: 700; line-height: var(--leading-snug); letter-spacing: var(--tracking-tight); }
```

`src/app/TabBar.tsx` (bottom tab bar, iOS convention: icon over label, within thumb reach):
```tsx
import { CalendarDays, ChartLine, NotebookPen, type LucideIcon } from "lucide-react";
import type { Tab } from "../state/uiStore";
import styles from "./TabBar.module.css";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "log", label: "Log", icon: NotebookPen },
  { id: "stats", label: "Stats", icon: ChartLine },
  { id: "history", label: "History", icon: CalendarDays },
];

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className={styles.tabbar}>
      <div role="tablist" aria-label="Sections" className={styles.inner}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            className={[styles.tab, tab === id ? styles.active : ""].filter(Boolean).join(" ")}
            onClick={() => onTab(id)}
          >
            <Icon size={24} strokeWidth={tab === id ? 2.25 : 1.75} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```
`src/app/TabBar.module.css`:
```css
/* Translucent material: content scrolls underneath; solid under reduced transparency (a11y.css). */
.tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  background: var(--material);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
.inner { max-width: 720px; margin: 0 auto; display: flex; height: var(--tabbar-h); padding: 0 max(8px, env(safe-area-inset-right)) 0 max(8px, env(safe-area-inset-left)); }
.tab {
  flex: 1; min-height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  background: none; border: 0; color: var(--muted); font-size: var(--text-xs); font-weight: 600; cursor: pointer;
  transition: transform var(--dur-press) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.tab:active { transform: scale(0.94); }
.active { color: var(--accent); }
```
Plan B docks the rest timer directly above this bar (`bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom))`) and adds its height to the main padding.

`src/app/Shell.tsx`:
```tsx
import { useEffect, useState } from "react";
import { exportBackup } from "../data/backup";
import { dumpRaw } from "../data/boot";
import { themePreference } from "../domain/theme";
import {
  HistoryPlaceholder, LogPlaceholder, SettingsPlaceholder, StatsPlaceholder,
} from "../features/placeholders";
import { useApp, useKv, useUi } from "../state/context";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { Banner } from "./Banner";
import { ErrorScreen } from "./ErrorScreen";
import { Header } from "./Header";
import { TabBar } from "./TabBar";
import { backupFilename, downloadText } from "./download";
import { applyTheme } from "./theme";
import styles from "./Shell.module.css";

export function Shell() {
  const kv = useKv();
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const bootKind = useApp((s) => s.bootKind);
  const doc = useApp((s) => s.doc);
  const saveError = useApp((s) => s.saveError);
  const dismissSaveError = useApp((s) => s.dismissSaveError);
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const sheet = useUi((s) => s.sheet);
  const openSheet = useUi((s) => s.openSheet);
  const closeSheet = useUi((s) => s.closeSheet);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    applyTheme(themePreference(doc.settings.theme));
  }, [doc.settings.theme]);

  if (status === "loading") return <main className={styles.center}>Loading…</main>;
  if (status === "error") {
    return (
      <ErrorScreen
        message={error ?? "Unknown error"}
        onDownloadRaw={async () => downloadText("overload-raw.json", JSON.stringify(await dumpRaw(kv), null, 2))}
      />
    );
  }

  return (
    <>
      {/* Everything behind an open sheet is inert: not focusable, not clickable, hidden from VoiceOver. */}
      <div data-shell-content inert={sheet !== null} aria-hidden={sheet !== null || undefined}>
      <Header onSettings={() => openSheet("settings")} />
      <main className={styles.main}>
        {bootKind === "migrated" && !bannerDismissed && (
          <Banner>
            <span>Your data was copied to the new version. Your original data is untouched.</span>
            <Button variant="ghost" onClick={() => downloadText(backupFilename(), exportBackup(doc))}>
              Download backup
            </Button>
            <Button variant="ghost" onClick={() => setBannerDismissed(true)}>
              Dismiss
            </Button>
          </Banner>
        )}
        {saveError && (
          <Banner tone="error" role="alert">
            <span>{saveError}</span>
            <Button variant="ghost" onClick={dismissSaveError} aria-label="Dismiss error">
              Dismiss
            </Button>
          </Banner>
        )}
        {tab === "log" && <LogPlaceholder />}
        {tab === "stats" && <StatsPlaceholder />}
        {tab === "history" && <HistoryPlaceholder />}
      </main>
      <TabBar tab={tab} onTab={setTab} />
      </div>
      {sheet === "settings" && (
        <Sheet title="Settings" onClose={closeSheet}>
          <SettingsPlaceholder />
        </Sheet>
      )}
    </>
  );
}
```
`src/app/Shell.module.css`:
```css
.main { max-width: 720px; margin: 0 auto; padding: 16px max(16px, env(safe-area-inset-right)) calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 24px) max(16px, env(safe-area-inset-left)); }
.center { padding: 40px; text-align: center; color: var(--muted); }
```
The banner's "Dismiss" button and the error bar's "Dismiss error" button must remain distinguishable by accessible name: the banner uses text "Dismiss"; the error bar button uses `aria-label="Dismiss error"`.

`src/app/App.tsx` (replace the stub):
```tsx
import { useEffect, useState } from "react";
import type { KeyValueStore } from "../data/kv";
import { createAppStore } from "../state/appStore";
import { StoreProvider } from "../state/context";
import { createUiStore } from "../state/uiStore";
import { ErrorBoundary } from "./ErrorBoundary";
import { Shell } from "./Shell";

export function App({ kv }: { kv: KeyValueStore }) {
  const [stores] = useState(() => ({ app: createAppStore(kv), ui: createUiStore(kv) }));

  useEffect(() => {
    void stores.ui.getState().hydrate();
    void stores.app.getState().init();
  }, [stores]);

  return (
    <StoreProvider value={{ ...stores, kv }}>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </StoreProvider>
  );
}
```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. If React warns about `act` in the App-level tests, wrap awaited UI changes with `findBy*`/`waitFor` (already used); do not silence the warning with mocks.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(app): add shell with bottom tab bar, settings sheet, migration banner and error screens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


### Task 7: Settings sheet

**Files:**
- Create: `src/features/settings/SettingsScreen.tsx`, `src/features/settings/SettingsScreen.module.css`, `src/app/readFile.ts`, `tests/features/settings.test.tsx`
- Modify: `src/app/Shell.tsx` (render `SettingsScreen` inside the Settings sheet), `src/features/placeholders.tsx` (delete `SettingsPlaceholder`)

**Interfaces:**
- Consumes: `useApp`, `useUi` (`openSheet`), `Segmented`, `NumberField`, `Card`, `Button`, `downloadText`, `backupFilename`, `exportBackup`, `parseBackup`, `themePreference`, `StoreDoc`.
- Produces: `SettingsScreen()`; `readFileText(file: File): Promise<string>` (FileReader-based, works in browsers and jsdom).

Behavior (matches the parity appendix, plus fix 4): Units (lb/kg; choosing a unit sets `increment` to 2.5 for kg, 5 for lb; hint "Relabels only; won't convert logged numbers."); Increment (min 0, decimals ok, label `Increment (${unit} per jump)`); one card per type titled "Compound rules"/"Isolation rules" with Sets to advance (min 1), Warm-up sets (min 0), Rep range — low (min 1, max repTop−1), Rep range — high (min repBottom+1), and the live hint `{repTop}+ × {sets} set(s) → +{increment} {unit}.`; Rest timer card (Default (seconds), min 5); Appearance (System/Dark/Light); Exercise library (a "Manage exercises" row that switches the sheet to the Exercise library view); Data & backup (Export backup; Import backup with a confirmation step showing counts before anything is replaced). The screen renders inside the Settings sheet, so it has no page title of its own.

- [ ] **Step 1: Write the failing test `tests/features/settings.test.tsx`**

```tsx
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { SettingsScreen } from "../../src/features/settings/SettingsScreen";
import { V2_KEY } from "../../src/data/store";
import { DEFAULT_SETTINGS } from "../../src/domain/settings";
import { syntheticBackup } from "../helpers/fixtures";
import { renderWithStore } from "../helpers/renderWithStore";

const download = vi.hoisted(() => vi.fn());
vi.mock("../../src/app/download", async (orig) => ({ ...(await orig<object>()), downloadText: download }));

afterEach(() => download.mockClear());

const stored = (kv: { dump(): Record<string, string> }) => JSON.parse(kv.dump()[V2_KEY]!);
const region = (name: string) => within(screen.getByRole("region", { name }));
const file = (obj: unknown) => new File([typeof obj === "string" ? obj : JSON.stringify(obj)], "backup.json", { type: "application/json" });

describe("units and increment", () => {
  it("choosing kg relabels and sets the increment to 2.5; lb sets it back to 5", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    await user.click(screen.getByRole("radio", { name: "kg" }));
    await waitFor(() => expect(stored(kv).settings).toMatchObject({ unit: "kg", increment: 2.5 }));
    expect(screen.getByLabelText("Increment (kg per jump)")).toHaveValue("2.5");
    await user.click(screen.getByRole("radio", { name: "lb" }));
    await waitFor(() => expect(stored(kv).settings).toMatchObject({ unit: "lb", increment: 5 }));
    expect(screen.getByText("Relabels only; won't convert logged numbers.")).toBeInTheDocument();
  });

  it("accepts a decimal increment and rejects a negative one with a message", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const input = screen.getByLabelText("Increment (lb per jump)");
    await user.clear(input);
    await user.type(input, "2.5");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.increment).toBe(2.5));
    await user.clear(input);
    await user.type(input, "-1");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number 0 or higher");
    expect(stored(kv).settings.increment).toBe(2.5);
  });
});

describe("rules cards", () => {
  it("edits sets-to-advance per type and updates the live hint (singular for one set)", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const compound = region("Compound rules");
    expect(compound.getByText("8+ × 2 sets → +5 lb.")).toBeInTheDocument();
    const sets = compound.getByLabelText("Sets to advance");
    await user.clear(sets);
    await user.type(sets, "1");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.compound.sets).toBe(1));
    expect(compound.getByText("8+ × 1 set → +5 lb.")).toBeInTheDocument();
    expect(stored(kv).settings.isolation.sets).toBe(DEFAULT_SETTINGS.isolation.sets);
  });

  it("rejects a rep-low at or above rep-high and leaves storage unchanged", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const compound = region("Compound rules");
    const low = compound.getByLabelText("Rep range — low");
    await user.clear(low);
    await user.type(low, "8");
    await user.tab();
    expect(compound.getByRole("alert")).toHaveTextContent("Enter a number from 1 to 7");
    expect(low).toHaveValue("6");
    expect(stored(kv).settings.compound.repBottom).toBe(6);
  });

  it("rejects rep-high at or below rep-low", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const compound = region("Compound rules");
    const high = compound.getByLabelText("Rep range — high");
    await user.clear(high);
    await user.type(high, "6");
    await user.tab();
    expect(compound.getByRole("alert")).toHaveTextContent("Enter a number 7 or higher");
    expect(stored(kv).settings.compound.repTop).toBe(8);
  });
});

describe("rest timer", () => {
  it("edits the default and rejects values under 5 seconds", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const card = region("Rest timer");
    const input = card.getByLabelText("Default (seconds)");
    await user.clear(input);
    await user.type(input, "90");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.restTimer.defaultSeconds).toBe(90));
    await user.clear(input);
    await user.type(input, "3");
    await user.tab();
    expect(card.getByRole("alert")).toHaveTextContent("Enter a number 5 or higher");
    expect(stored(kv).settings.restTimer.defaultSeconds).toBe(90);
  });
});

describe("appearance", () => {
  it("shows System for legacy theme values and stores a new choice", async () => {
    const legacy = { ...syntheticBackup(), settings: { ...syntheticBackup().settings, theme: "ember" } };
    const { user, kv } = await renderWithStore(<SettingsScreen />, { legacy });
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(stored(kv).settings.theme).toBe("dark"));
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("exercise library", () => {
  it("Manage exercises switches the sheet to the library view", async () => {
    const { user, uiStore } = await renderWithStore(<SettingsScreen />);
    uiStore.getState().openSheet("settings");
    await user.click(screen.getByRole("button", { name: "Manage exercises" }));
    expect(uiStore.getState().sheet).toBe("exercises");
  });
});

describe("export", () => {
  it("downloads a v2 backup of the current data", async () => {
    const { user } = await renderWithStore(<SettingsScreen />);
    await user.click(screen.getByRole("button", { name: "Export backup" }));
    const [filename, text] = download.mock.calls[0]!;
    expect(filename).toMatch(/^overload-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ app: "overload", version: 2 });
    expect(parsed.exercises).toHaveLength(syntheticBackup().exercises.length);
  });
});

describe("import", () => {
  const v1 = {
    app: "overload", version: 1,
    exercises: [{ id: "x", name: "X Press", type: "compound", muscleGroup: "Chest" }],
    sessions: [], customGroups: [], settings: DEFAULT_SETTINGS,
  };

  it("asks for confirmation with counts, and Cancel changes nothing", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const before = kv.dump()[V2_KEY];
    await user.upload(screen.getByLabelText("Import backup"), file(v1));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm import" });
    expect(dialog).toHaveTextContent("This backup has 1 exercises and 0 sessions");
    expect(dialog).toHaveTextContent(`currently stored (${syntheticBackup().exercises.length} exercises, ${syntheticBackup().sessions.length} sessions)`);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });

  it("Replace my data replaces the store and confirms", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    await user.upload(screen.getByLabelText("Import backup"), file(v1));
    await user.click(await screen.findByRole("button", { name: "Replace my data" }));
    expect(await screen.findByText("Backup imported.")).toBeInTheDocument();
    expect(stored(kv).exercises.map((e: { id: string }) => e.id)).toEqual(["x"]);
    expect(stored(kv).sessions).toEqual([]);
  });

  it("rejects non-JSON and non-Overload files with a message and keeps existing data", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const before = kv.dump()[V2_KEY];
    await user.upload(screen.getByLabelText("Import backup"), file("{nope"));
    expect(await screen.findByText("Import failed: Backup file is not valid JSON")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Import backup"), file({ hello: 1 }));
    expect(await screen.findByText("Import failed: Not an Overload backup file")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });

  it("rejects a structurally invalid backup before offering to replace anything", async () => {
    const { user, kv } = await renderWithStore(<SettingsScreen />);
    const before = kv.dump()[V2_KEY];
    const bad = { ...v1, sessions: [{ id: "s", date: "not-a-date", name: "", blocks: [] }] };
    await user.upload(screen.getByLabelText("Import backup"), file(bad));
    expect(await screen.findByText(/Import failed: sessions\[0\] has invalid date/)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/features/settings.test.tsx`
Expected: FAIL — `SettingsScreen` not found.

- [ ] **Step 3: Implement `src/app/readFile.ts`**

```ts
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsText(file);
  });
}
```

- [ ] **Step 4: Implement `SettingsScreen.tsx` and its CSS**

`src/features/settings/SettingsScreen.tsx`:
```tsx
import { ChevronRight, Timer } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { backupFilename, downloadText } from "../../app/download";
import { readFileText } from "../../app/readFile";
import { exportBackup, parseBackup } from "../../data/backup";
import { themePreference, type ThemePref } from "../../domain/theme";
import type { StoreDoc } from "../../domain/types";
import { useApp, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { NumberField } from "../../ui/NumberField";
import { Segmented } from "../../ui/Segmented";
import styles from "./SettingsScreen.module.css";

const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function SettingsScreen() {
  const doc = useApp((s) => s.doc);
  const settings = doc.settings;
  const updateSettings = useApp((s) => s.updateSettings);
  const replaceDoc = useApp((s) => s.replaceDoc);
  const openSheet = useUi((s) => s.openSheet);
  const [pending, setPending] = useState<StoreDoc | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    setMsg(null);
    setPending(null);
    if (!file) return;
    try {
      setPending(parseBackup(await readFileText(file), () => {}));
    } catch (err) {
      setMsg({ ok: false, text: `Import failed: ${errMessage(err)}` });
    }
  }

  async function confirmImport() {
    if (!pending) return;
    const ok = await replaceDoc(pending);
    setPending(null);
    setMsg(ok ? { ok: true, text: "Backup imported." } : { ok: false, text: "Import failed: could not save the backup." });
  }

  return (
    <div className={styles.stack}>
      <Card title="Units">
        <Segmented
          label="Units"
          value={settings.unit}
          options={[
            { value: "lb", label: "lb" },
            { value: "kg", label: "kg" },
          ]}
          onChange={(unit) => updateSettings((s) => ({ ...s, unit, increment: unit === "kg" ? 2.5 : 5 }))}
        />
        <p className={styles.hint}>Relabels only; won&apos;t convert logged numbers.</p>
        <div className={styles.narrow}>
          <NumberField
            label={`Increment (${settings.unit} per jump)`}
            value={settings.increment}
            min={0}
            onChange={(v) => updateSettings((s) => ({ ...s, increment: v }))}
          />
        </div>
      </Card>

      {(["compound", "isolation"] as const).map((type) => {
        const t = settings[type];
        const patch = (p: Partial<typeof t>) => updateSettings((s) => ({ ...s, [type]: { ...s[type], ...p } }));
        return (
          <Card key={type} title={`${type === "compound" ? "Compound" : "Isolation"} rules`}>
            <div className={styles.grid}>
              <NumberField label="Sets to advance" value={t.sets} min={1} onChange={(v) => patch({ sets: v })} />
              <NumberField label="Warm-up sets" value={t.warmupSets} min={0} onChange={(v) => patch({ warmupSets: v })} />
              <NumberField label="Rep range — low" value={t.repBottom} min={1} max={t.repTop - 1} onChange={(v) => patch({ repBottom: v })} />
              <NumberField label="Rep range — high" value={t.repTop} min={t.repBottom + 1} onChange={(v) => patch({ repTop: v })} />
            </div>
            <p className={styles.hint}>
              {t.repTop}+ × {t.sets} set{t.sets === 1 ? "" : "s"} → +{settings.increment} {settings.unit}.
            </p>
          </Card>
        );
      })}

      <Card title="Rest timer">
        <div className={styles.narrow}>
          <NumberField
            label="Default (seconds)"
            value={settings.restTimer.defaultSeconds}
            min={5}
            onChange={(v) => updateSettings((s) => ({ ...s, restTimer: { ...s.restTimer, defaultSeconds: v } }))}
          />
        </div>
        <p className={styles.hint}>
          <Timer size={14} aria-hidden /> Presets are 1:00, 2:00, 3:00 and your default.
        </p>
      </Card>

      <Card title="Appearance">
        <Segmented<ThemePref>
          label="Appearance"
          value={themePreference(settings.theme)}
          options={[
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={(theme) => updateSettings((s) => ({ ...s, theme }))}
        />
      </Card>

      <Card title="Exercise library">
        <button type="button" className={styles.navRow} onClick={() => openSheet("exercises")}>
          <span>Manage exercises</span>
          <span className={styles.navMeta}>
            {doc.exercises.length} <ChevronRight size={18} aria-hidden />
          </span>
        </button>
      </Card>

      <Card title="Data & backup">
        <p className={styles.hint}>Stored on this device. Export to back up; import replaces current data.</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => downloadText(backupFilename(), exportBackup(doc))}>
            Export backup
          </Button>
          <label className={styles.fileButton}>
            Import backup
            <input type="file" accept="application/json,.json" onChange={onFile} className={styles.file} />
          </label>
        </div>
        {pending && (
          <div role="alertdialog" aria-label="Confirm import" className={styles.confirm}>
            <p>
              This backup has {pending.exercises.length} exercises and {pending.sessions.length} sessions. Importing
              replaces everything currently stored ({doc.exercises.length} exercises, {doc.sessions.length} sessions).
            </p>
            <div className={styles.actions}>
              <Button variant="danger" onClick={confirmImport}>
                Replace my data
              </Button>
              <Button onClick={() => setPending(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {msg && (
          <p role="status" className={msg.ok ? styles.ok : styles.fail}>
            {msg.text}
          </p>
        )}
      </Card>
    </div>
  );
}
```

`src/features/settings/SettingsScreen.module.css`:
```css
.stack { display: flex; flex-direction: column; gap: 16px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.narrow { max-width: 220px; margin-top: 14px; }
.hint { font-size: var(--text-sm); color: var(--muted); margin-top: 10px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.fileButton {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 0 18px; border: 1px solid var(--line); border-radius: var(--radius-sm);
  font-size: var(--text-md); font-weight: 600; cursor: pointer; position: relative;
}
.fileButton:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.fileButton { transition: transform var(--dur-press) var(--ease-out); }
.fileButton:active { transform: scale(0.97); }
.navRow {
  width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between;
  background: none; border: 0; padding: 0; color: var(--text); font-size: var(--text-base); cursor: pointer;
}
.navRow:active { opacity: 0.6; }
.navMeta { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
.file { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.confirm { margin-top: 14px; padding: 12px; border-radius: var(--radius-sm); background: var(--warn-soft); font-size: var(--text-md); }
.confirm p { margin-bottom: 12px; }
.ok { margin-top: 10px; font-size: var(--text-sm); color: var(--accent); }
.fail { margin-top: 10px; font-size: var(--text-sm); color: var(--danger); }
```

- [ ] **Step 5: Wire the screen into the shell**

In `src/features/placeholders.tsx` delete the `SettingsPlaceholder` export. In `src/app/Shell.tsx` remove `SettingsPlaceholder` from the import list, add `import { SettingsScreen } from "../features/settings/SettingsScreen";` and render `<SettingsScreen />` as the Settings sheet's child in place of `<SettingsPlaceholder />`.

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. (Region queries rely on `Card` exposing `aria-label` from its title; see Task 3.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(settings): add Settings sheet with validation, appearance, library link and guarded import" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Exercise library (Manage exercises)

**Files:**
- Create: `src/features/exercises/ExercisesManager.tsx`, `src/features/exercises/ExercisesManager.module.css`, `tests/features/exercises.test.tsx`
- Modify: `src/app/Shell.tsx` (render the manager as the sheet's "exercises" view, with Back to Settings), `tests/app/shell.test.tsx` (one test)

**Interfaces:**
- Consumes: `useApp` actions `addGroup`, `updateExercise`, `deleteExercise`; `allMuscleGroups`, `groupByMuscleFull`, `sessionsWithExercise`; `TypeBadge`, `Input`, `Select`, `Button`, `IconButton`, `Sheet`.
- Produces: `ExercisesManager()`.

Behavior: add muscle group input (placeholder "Add a new muscle group (e.g. Forearms)") + "Add" button — messages "Enter a group name" (blank) and "That group already exists" (case-insensitive duplicate); "No exercises added yet." when there are none; every group listed (including empty ones, with "No exercises yet — it'll show up when you add one to this group."); exercise row view = name, type badge, Edit (`Edit {name}`), Delete (`Delete {name}`) which arms the row: it states the cost ("Deletes {name} and its {n} logged session(s)." or "Deletes {name}. It has no logged sessions."), shows a danger "Confirm delete" button and a "Cancel" button, and only Confirm cascades; edit row = name, group select, type select, "Save exercise" — a blank name is **not** saved and shows "Name can't be empty" (fix 4).

- [ ] **Step 1: Write the failing test `tests/features/exercises.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ExercisesManager } from "../../src/features/exercises/ExercisesManager";
import { V2_KEY } from "../../src/data/store";
import { syntheticBackup } from "../helpers/fixtures";
import { renderWithStore } from "../helpers/renderWithStore";

const stored = (kv: { dump(): Record<string, string> }) => JSON.parse(kv.dump()[V2_KEY]!);

describe("listing", () => {
  it("lists every group, including empty and custom ones, with exercises under their group", async () => {
    await renderWithStore(<ExercisesManager />);
    expect(screen.getByRole("heading", { name: "Chest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Neck" })).toBeInTheDocument();
    expect(screen.getByText("Ramp Squat")).toBeInTheDocument();
    expect(screen.getAllByText(/No exercises yet — it'll show up when you add one to this group\./).length).toBeGreaterThan(0);
  });

  it("shows the empty message when there are no exercises", async () => {
    const empty = { ...syntheticBackup(), exercises: [], sessions: [] };
    await renderWithStore(<ExercisesManager />, { legacy: empty });
    expect(screen.getByText("No exercises added yet.")).toBeInTheDocument();
  });
});

describe("adding a muscle group", () => {
  it("adds, clears the input and lists the new group", async () => {
    const { user, kv } = await renderWithStore(<ExercisesManager />);
    const input = screen.getByPlaceholderText("Add a new muscle group (e.g. Forearms)");
    await user.type(input, "Forearms");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("heading", { name: "Forearms" })).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(stored(kv).customGroups).toContain("Forearms");
  });

  it("explains blank and duplicate names and writes nothing", async () => {
    const { user, kv } = await renderWithStore(<ExercisesManager />);
    const before = kv.dump()[V2_KEY];
    const input = screen.getByPlaceholderText("Add a new muscle group (e.g. Forearms)");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a group name");
    await user.type(input, "chest");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That group already exists");
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});

describe("editing an exercise", () => {
  it("saves name, group and type", async () => {
    const { user, kv } = await renderWithStore(<ExercisesManager />);
    await user.click(screen.getByRole("button", { name: "Edit Curl" }));
    const name = screen.getByRole("textbox", { name: "Exercise name" });
    await user.clear(name);
    await user.type(name, "Hammer Curl");
    await user.selectOptions(screen.getByRole("combobox", { name: "Muscle group" }), "Back");
    await user.selectOptions(screen.getByRole("combobox", { name: "Exercise type" }), "compound");
    await user.click(screen.getByRole("button", { name: "Save exercise" }));
    await waitFor(() =>
      expect(stored(kv).exercises.find((e: { id: string }) => e.id === "ex-iso")).toMatchObject({
        name: "Hammer Curl", muscleGroup: "Back", type: "compound",
      }),
    );
    expect(screen.queryByRole("button", { name: "Save exercise" })).toBeNull();
    expect(screen.getByText("Hammer Curl")).toBeInTheDocument();
  });

  it("does not save a blank name: shows a message and keeps editing", async () => {
    const { user, kv } = await renderWithStore(<ExercisesManager />);
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("button", { name: "Edit Curl" }));
    await user.clear(screen.getByRole("textbox", { name: "Exercise name" }));
    await user.click(screen.getByRole("button", { name: "Save exercise" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Name can't be empty");
    expect(screen.getByRole("button", { name: "Save exercise" })).toBeInTheDocument();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});

describe("deleting an exercise", () => {
  it("needs a second click on Confirm delete, then cascades into sessions", async () => {
    const legacy = syntheticBackup();
    legacy.sessions.push({
      id: "only-blow", date: "2026-04-01", name: "Solo",
      blocks: [{ id: "bb", exerciseId: "ex-blow", sets: [{ weight: 50, reps: 8, warmup: false }] }],
    });
    const { user, kv } = await renderWithStore(<ExercisesManager />, { legacy });
    await user.click(screen.getByRole("button", { name: "Delete Blowout Row" }));
    expect(stored(kv).exercises.some((e: { id: string }) => e.id === "ex-blow")).toBe(true);
    const n = legacy.sessions.filter((s) => s.blocks.some((b) => b.exerciseId === "ex-blow")).length;
    expect(screen.getByText(`Deletes Blowout Row and its ${n} logged session${n === 1 ? "" : "s"}.`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(stored(kv).exercises.some((e: { id: string }) => e.id === "ex-blow")).toBe(false));
    const sessions = stored(kv).sessions as { id: string; blocks: { exerciseId: string }[] }[];
    expect(sessions.some((s) => s.id === "only-blow")).toBe(false);
    expect(sessions.flatMap((s) => s.blocks).some((b) => b.exerciseId === "ex-blow")).toBe(false);
    expect(screen.queryByText("Blowout Row")).toBeNull();
  });

  it("arms only the clicked row", async () => {
    const { user } = await renderWithStore(<ExercisesManager />);
    await user.click(screen.getByRole("button", { name: "Delete Curl" }));
    expect(screen.getAllByRole("button", { name: "Confirm delete" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Delete Ramp Squat" })).toBeInTheDocument();
    const row = screen.getByText("Curl").closest("li")!;
    expect(within(row).getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("Cancel disarms the row and deletes nothing", async () => {
    const { user, kv } = await renderWithStore(<ExercisesManager />);
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("button", { name: "Delete Curl" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Confirm delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete Curl" })).toBeInTheDocument();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/features/exercises.test.tsx`
Expected: FAIL — `ExercisesManager` not found.

- [ ] **Step 3: Implement `ExercisesManager.tsx` and CSS**

`src/features/exercises/ExercisesManager.tsx`:
```tsx
import { Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { allMuscleGroups, groupByMuscleFull, sessionsWithExercise } from "../../domain/exercises";
import type { Exercise, ExerciseType } from "../../domain/types";
import { useApp } from "../../state/context";
import { Button } from "../../ui/Button";
import { Input, Select } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import { TypeBadge } from "../../ui/TypeBadge";
import styles from "./ExercisesManager.module.css";

function deleteCost(name: string, n: number): string {
  return n === 0 ? `Deletes ${name}. It has no logged sessions.` : `Deletes ${name} and its ${n} logged session${n === 1 ? "" : "s"}.`;
}

export function ExercisesManager() {
  const doc = useApp((s) => s.doc);
  const exercises = doc.exercises;
  const customGroups = useApp((s) => s.doc.customGroups);
  const addGroup = useApp((s) => s.addGroup);
  const updateExercise = useApp((s) => s.updateExercise);
  const deleteExercise = useApp((s) => s.deleteExercise);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editType, setEditType] = useState<ExerciseType>("compound");
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);

  const groupOptions = allMuscleGroups(exercises, customGroups);
  const grouped = groupByMuscleFull(groupOptions, exercises);
  const nothingYet = !exercises.length && Object.values(grouped).every((g) => g.length === 0);

  async function submitGroup() {
    const result = await addGroup(newGroup);
    if (result === "added") {
      setNewGroup("");
      setGroupError(null);
    } else if (result === "empty") setGroupError("Enter a group name");
    else if (result === "duplicate") setGroupError("That group already exists");
  }

  function startEdit(ex: Exercise) {
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditGroup(ex.muscleGroup || "Other");
    setEditType(ex.type || "compound");
    setEditError(null);
  }

  async function saveEdit(ex: Exercise) {
    const name = editName.trim();
    if (!name) {
      setEditError("Name can't be empty");
      return;
    }
    if (await updateExercise(ex.id, { name, muscleGroup: editGroup, type: editType })) setEditingId(null);
  }

  return (
    <div className={styles.stack}>
      <div className={styles.addRow}>
        <Input
          aria-label="New muscle group"
          placeholder="Add a new muscle group (e.g. Forearms)"
          value={newGroup}
          onChange={(e) => {
            setNewGroup(e.target.value);
            setGroupError(null);
          }}
        />
        <Button variant="primary" onClick={submitGroup}>
          Add
        </Button>
      </div>
      {groupError && (
        <p role="alert" className={styles.error}>
          {groupError}
        </p>
      )}

      {nothingYet && <p className={styles.muted}>No exercises added yet.</p>}

      {Object.entries(grouped).map(([group, exs]) => (
        <section key={group}>
          <h3 className={styles.groupTitle}>{group}</h3>
          {exs.length === 0 ? (
            <p className={styles.empty}>No exercises yet — it&apos;ll show up when you add one to this group.</p>
          ) : (
            <ul className={styles.list}>
              {exs.map((ex) => (
                <li key={ex.id} className={styles.row}>
                  {editingId === ex.id ? (
                    <>
                      <Input aria-label="Exercise name" value={editName} onChange={(e) => { setEditName(e.target.value); setEditError(null); }} />
                      <Select aria-label="Muscle group" value={editGroup} onChange={(e) => setEditGroup(e.target.value)}>
                        {groupOptions.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </Select>
                      <Select aria-label="Exercise type" value={editType} onChange={(e) => setEditType(e.target.value as ExerciseType)}>
                        <option value="compound">Compound</option>
                        <option value="isolation">Isolation</option>
                      </Select>
                      <IconButton label="Save exercise" onClick={() => saveEdit(ex)}>
                        <Check size={18} />
                      </IconButton>
                      {editError && <p role="alert" className={styles.error}>{editError}</p>}
                    </>
                  ) : (
                    <>
                      <span className={styles.name}>{ex.name}</span>
                      <TypeBadge type={ex.type} />
                      <IconButton label={`Edit ${ex.name}`} onClick={() => startEdit(ex)}>
                        <Pencil size={16} />
                      </IconButton>
                      {confirmId === ex.id ? (
                        <div className={styles.confirm}>
                          <p className={styles.cost}>{deleteCost(ex.name, sessionsWithExercise(doc, ex.id))}</p>
                          <Button
                            variant="danger"
                            onClick={async () => {
                              await deleteExercise(ex.id);
                              setConfirmId(null);
                            }}
                          >
                            Confirm delete
                          </Button>
                          <Button onClick={() => setConfirmId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <IconButton label={`Delete ${ex.name}`} onClick={() => setConfirmId(ex.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
```

`src/features/exercises/ExercisesManager.module.css`:
```css
.stack { display: flex; flex-direction: column; gap: 16px; }
.addRow { display: flex; gap: 8px; }
.groupTitle { font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 12px; }
.name { flex: 1; font-size: var(--text-md); }
.muted, .empty { font-size: var(--text-sm); color: var(--muted); }
.empty { font-style: italic; }
.error { width: 100%; font-size: var(--text-sm); color: var(--danger); }
.confirm { width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cost { width: 100%; font-size: var(--text-sm); color: var(--danger); }
```

- [ ] **Step 4: Show the manager as the sheet's library view**

In `src/app/Shell.tsx` add `import { ExercisesManager } from "../features/exercises/ExercisesManager";` and, after the Settings sheet, render:
```tsx
      {sheet === "exercises" && (
        <Sheet title="Exercises" onClose={closeSheet} onBack={() => openSheet("settings")} backLabel="Settings">
          <ExercisesManager />
        </Sheet>
      )}
```
Append to `describe("Shell", ...)` in `tests/app/shell.test.tsx`:
```tsx
  it("Settings → Manage exercises opens the library; Back returns to Settings", async () => {
    const { user } = await renderWithStore(<Shell />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Manage exercises" }));
    expect(screen.getByRole("dialog", { name: "Exercises" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });
```
(Plan B adds a second entry point from the Log screen's exercise picker.)

- [ ] **Step 5: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(exercises): add exercise library sheet with group, edit and costed cascade delete" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Real-data verification, screenshots and handoff

**Files:**
- Modify: `HANDOFF.md`

**Interfaces:** none (verification and documentation).

- [ ] **Step 1: Run the full gate and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build && ls dist/next.html dist/index.html dist/dev.html`
Expected: all tests pass, typecheck and lint clean, build succeeds, all three HTML files exist.

- [ ] **Step 2: Start the dev server (it serves `fixtures/` at the project root)**

Run in the background: `npx vite --port 5173 --strictPort`
Expected: Vite reports `Local: http://localhost:5173/`.

- [ ] **Step 3: Load the real data in a browser and verify the migration**

Load the Playwright tools with ToolSearch (`select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_emulate_media,mcp__plugin_playwright_playwright__browser_click,mcp__plugin_playwright_playwright__browser_snapshot,mcp__plugin_playwright_playwright__browser_close`). Then:
1. Navigate to `http://localhost:5173/next.html`.
2. Evaluate (seeds the real backup into the four legacy keys, as the old app would have stored them, then reloads):
```js
async () => {
  const b = await (await fetch('/fixtures/real-backup.json')).json();
  for (const k of ['exercises', 'sessions', 'customGroups', 'settings']) localStorage.setItem(k, JSON.stringify(b[k]));
  window.__legacySnapshot = Object.fromEntries(['exercises','sessions','customGroups','settings'].map(k => [k, localStorage.getItem(k)]));
  sessionStorage.setItem('legacy', JSON.stringify(window.__legacySnapshot));
  location.reload();
}
```
3. Evaluate and confirm: the banner text "Your data was copied" is present; `JSON.parse(localStorage.getItem('overload.v2'))` has `exercises.length === 41` and `sessions.length === 57`; and for each legacy key `localStorage.getItem(k) === JSON.parse(sessionStorage.getItem('legacy'))[k]` (legacy keys byte-identical).
Expected: all three confirmations hold. If any fails, stop and debug (do not edit expectations).

- [ ] **Step 4: Screenshot every screen in both themes**

At a phone viewport (390×844) screenshot the Log tab, the Settings sheet (scroll through all cards) and the Exercises view, with `browser_emulate_media` set to `colorScheme: "dark"` and then `"light"`; also click the Appearance radios (Dark, Light, System) and confirm the page theme follows. Then emulate `reducedMotion: "reduce"` and confirm the sheet fades in without travelling. Save the images under the session scratchpad and view them. Check by eye: text is readable, nothing clipped, tap targets comfortable, the tab bar sits above the home indicator and content scrolls under it, the sheet's Done and Back are reachable, banner and cards aligned.

- [ ] **Step 5: Stop the server and clean up**

Run: `pkill -f "vite --port 5173"; rm -rf .playwright-mcp`

- [ ] **Step 6: Update `HANDOFF.md` and show the State Update**

Add under `## Next` (above the existing list):
```
State Update <date>: UI Foundation (Plan A) done on `rewrite`: tokens (type/motion/material/a11y) + contrast gate, primitives incl. Sheet, stores, shell with bottom tab bar, Settings sheet, Exercise library, served at /next.html (old app still at /). Real data verified: 41 exercises / 57 sessions, legacy keys untouched.
Next: engine redesign spec (if not already written), then Plan B (Log tab built around the new engine: set editor, coaching card, warm-up ramp, rest timer docked above the tab bar, undo, UI-state persistence), then Plan C (Stats, History, e2e, cutover).
```
Commit:
```bash
git add HANDOFF.md && git commit -m "docs: update handoff after UI foundation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand off to the owner**

Show the screenshots and the gate output. Ask the owner to review the look in both themes and say what to adjust before Plan B starts.
