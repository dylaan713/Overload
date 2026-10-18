import { createElement, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

// Springs, in Apple's terms: no fixed duration, critically damped by default (bounce 0), and a little
// bounce only when the gesture that ended carried momentum (a flick). `duration` here is the
// perceptual response, not a timer.
export const SPRING = {
  default: { type: "spring", bounce: 0, duration: 0.4 },
  snappy: { type: "spring", bounce: 0, duration: 0.3 },
  momentum: { type: "spring", bounce: 0.2, duration: 0.3 },
} as const;

/**
 * Honors the system's reduced-motion setting: transforms are skipped, opacity still animates. Components
 * read it with useReducedMotionConfig, so their imperative springs follow it too (and tests can force it).
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return createElement(MotionConfig, { reducedMotion: "user", transition: SPRING.default }, children);
}

/** Reduced motion: no travel, a short cross-fade instead (apple-design §14). */
export const FADE = { type: "tween", ease: "easeOut", duration: 0.2 } as const;
