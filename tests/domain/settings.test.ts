import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, plateIncrement } from "../../src/domain/settings";

describe("mergeSettings", () => {
  it("returns a fresh copy of defaults for null/non-object input", () => {
    const a = mergeSettings(null);
    expect(a).toEqual(DEFAULT_SETTINGS);
    expect(a).not.toBe(DEFAULT_SETTINGS);
    expect(a.compound).not.toBe(DEFAULT_SETTINGS.compound);
    expect(mergeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial nested settings over defaults", () => {
    const s = mergeSettings({ unit: "kg", compound: { sets: 3 }, restTimer: {} });
    expect(s.unit).toBe("kg");
    expect(s.compound).toEqual({ sets: 3, repBottom: 6, repTop: 8, warmupSets: 2 });
    expect(s.isolation).toEqual(DEFAULT_SETTINGS.isolation);
    expect(s.restTimer.defaultSeconds).toBe(120);
  });
});

describe("plateIncrement", () => {
  it("is 2.5 for kg and 5 for lb", () => {
    expect(plateIncrement("kg")).toBe(2.5);
    expect(plateIncrement("lb")).toBe(5);
  });
});
