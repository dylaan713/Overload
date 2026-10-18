import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom can't run frame-based animation: animations jump to their end state, and tests assert end states.
// The physics (projection, rubber-band, release decisions) is covered by tests/ui/gesture.test.ts.
import { MotionGlobalConfig } from "motion/react";
MotionGlobalConfig.skipAnimations = true;

// jsdom has no PointerEvent; a MouseEvent subclass carries clientX/clientY and pointerId for drag tests.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
}
