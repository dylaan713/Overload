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

// ---- Review fixes (wave 1) ----

// Every custom property, raw text, per block: catches rgba tokens the hex parser skips.
function rawVars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

function rgba(v: string): [number, number, number, number] {
  const m = v.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`not rgba: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}
const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
function over(tint: string, base: string): string {
  const [r, g, b, a] = rgba(tint);
  const [br, bg, bb] = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  return `#${hex(r * a + br! * (1 - a))}${hex(g * a + bg! * (1 - a))}${hex(b * a + bb! * (1 - a))}`;
}

describe("light blocks stay identical, rgba tokens included", () => {
  it("the media block repeats every explicit light token", () => {
    expect(rawVars(css.slice(mediaStart))).toEqual(rawVars(css.slice(lightStart, mediaStart)));
  });
});

describe.each([
  ["dark", css.slice(css.indexOf(":root {"), lightStart), dark],
  ["light", css.slice(lightStart, mediaStart), light],
] as const)("%s tinted pairs", (_n, block, t) => {
  const raw = rawVars(block);
  const darkRaw = rawVars(css.slice(css.indexOf(":root {"), lightStart));
  for (const [fg, soft] of [["accent", "accent-soft"], ["warn", "warn-soft"], ["danger", "danger-soft"]] as const) {
    for (const bgKey of BACKGROUNDS) {
      it(`${fg} on ${soft} over ${bgKey} is at least 4.5:1`, () => {
        const tint = raw[soft] ?? darkRaw[soft]!;
        expect(contrast(t[fg]!, over(tint, t[bgKey]!))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("type sizes in CSS Modules", () => {
  it("only use --text-* tokens (or the 16px input floor)", () => {
    const bad = cssFiles("src")
      .filter((f) => f.endsWith(".module.css"))
      .flatMap((f) =>
        [...readFileSync(f, "utf8").matchAll(/(?:^|[;{\s])(font-size|font)\s*:\s*([^;]+);/g)]
          .filter((m) => !/^(var\(--text-[\w-]+\)|max\(16px, var\(--text-base\)\)|inherit)$/.test(m[2]!.trim()))
          .map((m) => `${f}: ${m[1]}: ${m[2]}`),
      );
    expect(bad).toEqual([]);
  });
});

describe("platform overrides", () => {
  const a11y = readFileSync("src/styles/a11y.css", "utf8");
  const base = readFileSync("src/styles/base.css", "utf8");

  it("reduced transparency also overrides both light-theme selectors", () => {
    const block = a11y.slice(a11y.indexOf("prefers-reduced-transparency"), a11y.indexOf("prefers-contrast"));
    expect(block).toContain(':root[data-theme="light"]');
    expect(block).toContain(':root:not([data-theme="dark"])');
    expect(block).toContain("--material: var(--surface)");
  });

  it("the Dynamic Type root applies on iOS only, not Mac Safari", () => {
    expect(base).toMatch(/@supports \(font: -apple-system-body\) and \(-webkit-touch-callout: none\)/);
  });
});
