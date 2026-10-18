// Pure gesture physics (apple-design §5, §6, §9). No DOM: everything here is unit-tested.

/** Release speed (px/s) above which a release counts as a flick: it carries momentum and gets a little bounce. */
export const FLICK = 300;

/** Where a release would come to rest, using Apple's exponential deceleration (≈ scroll deceleration). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further past it, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (overshoot === 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Commit (dismiss / go back) when the projected resting point is past half of `size`.
 * A deliberate flick back toward the start never commits: the velocity's sign decides reversal.
 */
export function commitOnRelease(offset: number, velocity: number, size: number): boolean {
  if (velocity < -FLICK) return false;
  return offset + project(velocity) > size / 2;
}

export interface Sample {
  t: number; // ms
  v: number; // px
}

/** px/s over the last 100ms of pointer samples; 0 with fewer than two. */
export function velocityFrom(samples: Sample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  const first = samples.find((s) => s.t >= last.t - 100) ?? last;
  const dt = last.t - first.t;
  return dt > 0 ? ((last.v - first.v) / dt) * 1000 : 0;
}
