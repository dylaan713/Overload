import type { Rir } from "./types";

/** How a set felt, in words. The engine keeps RIR numbers; the UI never shows them. */
export type Difficulty = "easy" | "moderate" | "hard" | "all-out";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "moderate", "hard", "all-out"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", moderate: "Moderate", hard: "Hard", "all-out": "All out" };

const RIR: Record<Difficulty, Rir> = { easy: 4, moderate: 2, hard: 1, "all-out": 0 };

export const rirFor = (d: Difficulty): Rir => RIR[d];

export function difficultyOf(rir: number): Difficulty {
  if (rir >= 4) return "easy";
  if (rir >= 2) return "moderate";
  return rir >= 1 ? "hard" : "all-out";
}

/** An aim range as words, easiest first: "Moderate–Hard", or one word when both ends read the same. */
export function aimLabel(rirLow: number, rirHigh: number): string {
  const easiest = DIFFICULTY_LABEL[difficultyOf(rirHigh)];
  const hardest = DIFFICULTY_LABEL[difficultyOf(rirLow)];
  return easiest === hardest ? easiest : `${easiest}–${hardest}`;
}
