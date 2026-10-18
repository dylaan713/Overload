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
