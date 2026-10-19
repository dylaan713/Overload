/**
 * iOS home-screen apps can get a web view that ends short of the screen (measured: 47px, the status-bar height,
 * on a 926px screen). Nothing drawn there shows; iOS fills the strip with the page background. Publish the gap
 * as `--app-gap` (px) and `data-app-gap`: the home indicator sits in the strip, so `--safe-bottom` drops the
 * bottom inset, and the tab bar matches the strip's colour. Elsewhere the gap is 0.
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
    const gap = bottomGap(screenHeight, fixedBottom);
    root.style.setProperty("--app-gap", `${gap}px`);
    root.toggleAttribute("data-app-gap", gap > 0);
    // TEMP diagnostics for the black-bar fix; remove once confirmed on the phone.
    root.dataset.viewportDebug = `screen ${screenHeight} · fixed ${Math.round(fixedBottom)} · inner ${innerHeight} · gap ${gap}`;
  };
  update();
  addEventListener("resize", update);
  addEventListener("orientationchange", () => requestAnimationFrame(update));
}
