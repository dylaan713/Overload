/**
 * iOS home-screen apps can end `position: fixed; bottom: 0` short of the screen's bottom edge: the sheet stops
 * above a black strip and the tab bar floats. Measure that gap and publish it as `--app-gap` (px), which the
 * full-screen boxes extend by and bottom-docked items drop by. Elsewhere the gap is 0.
 */

/** Pixels between where a fixed box's bottom lands and the screen's bottom edge (never negative). */
export function bottomGap(screenHeight: number, fixedBottom: number): number {
  return Math.max(0, Math.round(screenHeight - fixedBottom));
}

const isIOSHomeScreen = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  (matchMedia("(display-mode: standalone)").matches && CSS.supports("-webkit-touch-callout", "none"));

export function measureViewport(root: HTMLElement = document.documentElement): void {
  if (!isIOSHomeScreen()) return;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const update = () => {
    const portrait = matchMedia("(orientation: portrait)").matches;
    const screenHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    const fixedBottom = probe.getBoundingClientRect().bottom;
    root.style.setProperty("--app-gap", `${bottomGap(screenHeight, fixedBottom)}px`);
    // TEMP diagnostics for the black-bar fix; remove once confirmed on the phone.
    root.dataset.viewportDebug = `screen ${screenHeight} · fixed ${Math.round(fixedBottom)} · inner ${innerHeight} · gap ${bottomGap(screenHeight, fixedBottom)}`;
  };
  update();
  addEventListener("resize", update);
  addEventListener("orientationchange", () => requestAnimationFrame(update));
}
