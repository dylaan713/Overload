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
