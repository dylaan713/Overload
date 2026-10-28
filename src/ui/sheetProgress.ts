import { motionValue } from "motion/react";

/**
 * How much the page behind is itself: 1 with no sheet, 0 with one fully up.
 * One sheet is open at a time, so one value. The Sheet drives it and the Shell binds the page's transform to
 * it — a motion value, not a CSS custom property on :root, because writing one of those every frame
 * invalidates computed style for the whole document (and the page then reads its own layout back).
 */
export const sheetProgress = motionValue(1);
