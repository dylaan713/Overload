import { describe, it, expect } from "vitest";
import { DIFFICULTIES, aimLabel, difficultyOf, rirFor } from "../../src/domain/difficulty";

describe("difficulty", () => {
  it("maps words to stored rir", () => {
    expect(DIFFICULTIES.map(rirFor)).toEqual([4, 2, 1, 0]);
  });

  it("reads any rir as a word", () => {
    expect([4, 3, 2, 1, 0].map(difficultyOf)).toEqual(["easy", "moderate", "moderate", "hard", "all-out"]);
  });

  it("labels aim ranges, easiest first, one word when both ends match", () => {
    expect(aimLabel(0, 2)).toBe("Moderate–All out");
    expect(aimLabel(1, 2)).toBe("Moderate–Hard");
    expect(aimLabel(2, 3)).toBe("Moderate");
    expect(aimLabel(1, 1)).toBe("Hard");
  });
});
