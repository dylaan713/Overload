import type { Muscle } from "../../domain/types";

/**
 * The geometric figure: flat faceted plates in a 120 × 240 box per view. Plates are drawn for the figure's left
 * half (x ≤ 60) and mirrored at render, unless `center` (one plate across the midline). `muscle: null` is a
 * neutral base plate (head, hands, knees, feet). Gaps between plates come from a stroke in the panel color.
 */
export interface Plate { muscle: Muscle | null; points: string; center?: boolean }

export const VIEW_W = 120;
export const VIEW_H = 240;

const head: Plate = { muscle: null, center: true, points: "53,5 60,2 67,5 70,16 65,26 55,26 50,16" };
const neck: Plate = { muscle: null, center: true, points: "55,27 65,27 64,32 56,32" };
const hand: Plate = { muscle: null, points: "19,123 27,123 26,133 20,134" };
const foot: Plate = { muscle: null, points: "36,229 45,229 46,235 34,235" };
const forearm: Plate = { muscle: "forearms", points: "22,93 31,91 31,100 27,120 21,121 18,107" };

export const FRONT: Plate[] = [
  head,
  neck,
  { muscle: "traps", points: "55,32 50,36 40,40 36,40 47,34" },
  { muscle: "side-delts", points: "34,41 27,44 22,53 22,63 28,58 31,48" },
  { muscle: "front-delts", points: "36,41 44,42 41,53 33,61 29,58 32,48" },
  { muscle: "chest", points: "45,42 58,41 58,52 43,55 42,49" },
  { muscle: "chest", points: "43,57 58,54 58,66 48,68 40,62" },
  { muscle: "biceps", points: "23,66 30,62 34,72 31,88 25,90 21,79" },
  forearm,
  hand,
  { muscle: "abs", points: "50,70 58,70 58,79 50,79" },
  { muscle: "abs", points: "50,81 58,81 58,90 50,90" },
  { muscle: "abs", points: "50,92 58,92 58,101 50,101" },
  { muscle: "abs", points: "51,103 58,103 58,116 54,114" },
  { muscle: "obliques", points: "41,66 48,70 48,104 43,108 39,92 40,78" },
  { muscle: "abductors", points: "37,108 42,111 40,123 35,121" },
  { muscle: "quads", points: "35,124 41,116 49,120 51,148 46,168 39,172 34,150" },
  { muscle: "quads", points: "51,151 54,159 53,173 45,177 48,166" },
  { muscle: "adductors", points: "50,118 56,118 58,122 57,142 53,150 51,130" },
  { muscle: null, points: "39,175 46,179 45,186 38,184" },
  { muscle: "calves", points: "36,189 44,188 46,206 43,225 38,225 35,206" },
  foot,
];

export const BACK: Plate[] = [
  head,
  neck,
  { muscle: "traps", center: true, points: "60,28 68,32 77,39 66,46 64,64 60,70 56,64 54,46 43,39 52,32" },
  { muscle: "side-delts", points: "33,41 26,44 22,55 25,60 29,50" },
  { muscle: "rear-delts", points: "35,40 43,41 41,50 32,56 30,50" },
  { muscle: "upper-back", points: "44,43 53,48 55,63 46,61 41,52" },
  { muscle: "lats", points: "39,56 46,64 56,68 57,80 52,98 44,92 38,74" },
  { muscle: "lower-back", points: "53,100 57,82 59,84 59,110 53,111" },
  { muscle: "triceps", points: "23,63 31,58 34,70 31,86 25,88 21,76" },
  forearm,
  hand,
  { muscle: "abductors", points: "36,104 45,102 50,110 38,113 35,112" },
  { muscle: "glutes", points: "38,115 58,113 59,134 46,138 37,128" },
  { muscle: "hamstrings", points: "36,141 46,141 46,172 40,176 35,158" },
  { muscle: "hamstrings", points: "47,141 56,141 54,166 47,174" },
  { muscle: null, points: "39,178 47,178 46,186 39,186" },
  { muscle: "calves", points: "35,189 46,187 48,203 43,223 37,215 34,201" },
  { muscle: "calves", points: "47,189 54,189 53,205 48,214" },
  foot,
];
