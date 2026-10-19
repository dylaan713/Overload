import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

describe("cutover: the new app is the app", () => {
  const html = readFileSync("index.html", "utf8");
  const vite = readFileSync("vite.config.js", "utf8");

  it("index.html loads the new app with the Midnight theme colors", () => {
    expect(html).toContain('src="/src/main.tsx"');
    expect(html).toContain('content="#0e1118"');
    expect(html).not.toMatch(/#1C1B19|#C4451F/i);
    expect(html).not.toContain("noindex");
  });

  it("the old app and its side pages are gone", () => {
    for (const f of ["src/App.jsx", "src/main.jsx", "src/storage.js", "src/index.css", "next.html", "dev.html", "src/next", "src/dev"]) {
      expect(existsSync(f), f).toBe(false);
    }
    for (const f of files("src")) expect(readFileSync(f, "utf8"), f).not.toMatch(/App\.jsx|storage\.js|recharts|@fontsource\/(oswald|work-sans)/);
  });

  it("builds one page, and the manifest wears the new colors", () => {
    expect(vite).not.toMatch(/next\.html|dev\.html/);
    expect(vite).toContain("theme_color: '#0e1118'");
    expect(vite).toContain("background_color: '#0e1118'");
  });

  it("keeps a way to download the old app's data", () => {
    expect(existsSync("src/data/legacy.ts")).toBe(true);
    expect(readFileSync("src/features/settings/SettingsRoot.tsx", "utf8")).toContain("Download old app data");
  });

  it("registers the service worker from the new entry", () => {
    expect(readFileSync("src/main.tsx", "utf8")).toContain("virtual:pwa-register");
  });
});
