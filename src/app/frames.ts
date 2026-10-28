// TEMPORARY (wave 3): an on-device read of how smooth the animations actually are, because Chrome at 4x
// CPU never reproduced the lag on the phone. Remove this file, its Settings row and its call in main.tsx
// once Dylan has screenshotted it.

const SLOW_MS = 32; // two frames at 60Hz: anything longer is a visible stutter

export const frames = { count: 0, slow: 0, worst: 0, since: 0 };

export function resetFrames(now = performance.now()) {
  frames.count = 0;
  frames.slow = 0;
  frames.worst = 0;
  frames.since = now;
}

/** Counts long frames for as long as the app is open. One timestamp subtraction per frame, nothing else. */
export function watchFrames(): () => void {
  let last = performance.now();
  let id = 0;
  resetFrames(last);
  const tick = (now: number) => {
    const gap = now - last;
    last = now;
    frames.count++;
    if (gap > SLOW_MS) frames.slow++;
    if (gap > frames.worst) frames.worst = Math.round(gap);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

/** "3 slow frames of 412 · worst 68ms" */
export function framesLine(): string {
  return `${frames.slow} slow frames of ${frames.count} · worst ${frames.worst}ms`;
}
