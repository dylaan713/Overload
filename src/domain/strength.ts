// Epley estimated 1-rep max. Combines weight AND reps into one strength number
// so rep gains (not just heavier loads) show up as progress.
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}
