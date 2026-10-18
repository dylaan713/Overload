import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { MotionValue } from "motion/react";
import { velocityFrom, type Sample } from "./gesture";

const SLOP = 10; // px of hysteresis before a press becomes a drag, so taps stay taps

/**
 * 1:1 pointer drag on one axis of a motion value (apple-design §2, §3, §10).
 * - Tracks from where the finger went down, starting from the value's *current* (presentation) position,
 *   so grabbing something mid-animation continues from where it is.
 * - Pointer capture starts only after SLOP, so buttons inside the handle still click.
 * - On release, reports the raw offset and the velocity from the last 100ms.
 */
export function useAxisDrag(opts: {
  axis: "x" | "y";
  value: MotionValue<number>;
  /** May this press start a drag? (e.g. only near the left edge) */
  canStart?: (e: ReactPointerEvent<HTMLElement>) => boolean;
  /** The drag took over: stop any running animation. */
  onStart?: () => void;
  /** Map the raw position to what's shown (e.g. rubber-band past a boundary). */
  map?: (raw: number) => number;
  onRelease: (raw: number, velocity: number) => void;
}) {
  const o = useRef(opts);
  o.current = opts;
  const s = useRef<{ id: number; start: number; base: number; raw: number; active: boolean; samples: Sample[] } | null>(null);
  const coord = (e: ReactPointerEvent) => (o.current.axis === "x" ? e.clientX : e.clientY);
  const cancel = (id: number) => {
    const d = s.current;
    if (!d || d.id !== id) return;
    s.current = null;
    if (d.active) o.current.onRelease(d.raw, 0);
  };

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      // One finger owns a drag; a second touch is ignored rather than hijacking it.
      if (s.current || e.button > 0 || (o.current.canStart && !o.current.canStart(e))) return;
      s.current = { id: e.pointerId, start: coord(e), base: 0, raw: 0, active: false, samples: [] };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const d = s.current;
      if (!d || d.id !== e.pointerId) return;
      const delta = coord(e) - d.start;
      if (!d.active) {
        if (Math.abs(delta) < SLOP) return;
        d.active = true;
        o.current.onStart?.();
        d.base = o.current.value.get();
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      d.raw = d.base + delta;
      d.samples.push({ t: performance.now(), v: d.raw });
      o.current.value.set(o.current.map ? o.current.map(d.raw) : d.raw);
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const d = s.current;
      if (!d || d.id !== e.pointerId) return; // another finger lifting doesn't end this drag
      s.current = null;
      if (!d.active) return;
      d.samples.push({ t: performance.now(), v: d.raw });
      o.current.onRelease(d.raw, velocityFrom(d.samples));
    },
    onPointerCancel(e: ReactPointerEvent<HTMLElement>) {
      cancel(e.pointerId);
    },
    onLostPointerCapture(e: ReactPointerEvent<HTMLElement>) {
      cancel(e.pointerId);
    },
  };
}
