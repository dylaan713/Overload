import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotionConfig, useTransform, type AnimationPlaybackControlsWithThen } from "motion/react";
import { Button } from "./Button";
import { FLICK, commitOnRelease, rubberband, velocityFrom, type Sample } from "./gesture";
import { FADE, SPRING } from "./motion";
import { sheetProgress } from "./sheetProgress";
import { useAxisDrag } from "./useAxisDrag";
import styles from "./Sheet.module.css";

export interface SheetProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  headerAction?: ReactNode;
  /** Filled with this sheet's close, so content can dismiss it along the same animated path as Done. */
  closeRef?: { current: (() => void) | null };
  children: ReactNode;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const SLOP = 10; // px before a content pull counts as a drag (as in useAxisDrag)

/** The nearest vertically scrollable box between `el` and `stop`, if any. */
function scrollerOf(el: EventTarget | null, stop: Element): HTMLElement | null {
  for (let n = el instanceof Element ? el : null; n && n !== stop; n = n.parentElement) {
    if (n instanceof HTMLElement && n.scrollHeight > n.clientHeight && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
  }
  return null;
}

/**
 * Modal bottom sheet. It slides up on mount and leaves downward along the same path, then calls onClose.
 * Dragging the grabber/header follows the finger 1:1 (rubber-banding upward) and can be grabbed mid-animation;
 * so does pulling the content down while it's scrolled to the top (iOS). Release decides by projected momentum.
 * It drives `sheetProgress` (0 open → 1 gone) so the page behind can scale back in step, on the compositor.
 * Its own height is measured once per gesture, never per frame. The caller renders it only while open and
 * marks the page inert.
 * The inert page is what makes it modal: no aria-modal, because VoiceOver would then hide toasts and
 * alerts rendered beside the sheet (Undo, Dismiss).
 */
export function Sheet({ title, onClose, onBack, backLabel, headerAction, closeRef, children }: SheetProps) {
  const titleId = useId();
  const reduced = useReducedMotionConfig() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const anim = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const closing = useRef(0); // token of the close in flight; 0 = none
  const dragging = useRef(false);
  const tokens = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Measured on mount, on resize and when a gesture starts: reading it per frame forces a layout every frame.
  const box = useRef(0);
  const measure = () => {
    box.current = ref.current?.offsetHeight ?? 0;
  };
  const height = () => box.current || window.innerHeight;
  const setProgress = (p: number) => sheetProgress.set(clamp01(p));
  useMotionValueEvent(y, "change", (v) => setProgress(v / height()));
  useMotionValueEvent(fade, "change", (v) => setProgress(1 - v));
  const scrimOpacity = useTransform(() => (reduced ? fade.get() : 1 - clamp01(y.get() / height())));

  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    measure();
    window.addEventListener("resize", measure);
    setProgress(1);
    if (reduced) {
      fade.set(0);
      anim.current = animate(fade, 1, FADE);
    } else {
      y.set(height());
      anim.current = animate(y, 0, SPRING.default);
    }
    return () => {
      anim.current?.stop();
      window.removeEventListener("resize", measure);
      sheetProgress.set(1); // the page is itself again
      opener?.focus();
    };
    // Mount-only: entering is a one-time animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(velocity = 0) {
    // While a finger holds the sheet, the finger decides: release past the threshold closes it.
    if (closing.current || dragging.current) return;
    const token = (closing.current = ++tokens.current);
    // Commit whatever is being typed before the content unmounts.
    if (document.activeElement instanceof HTMLElement && ref.current?.contains(document.activeElement)) document.activeElement.blur();
    anim.current?.stop();
    anim.current = reduced
      ? animate(fade, 0, FADE)
      : animate(y, height(), { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
    // Reduced motion fades from wherever the finger left it; the page behind follows the fade.
    anim.current.then(() => {
      if (closing.current === token) onCloseRef.current();
    });
  }

  if (closeRef) closeRef.current = () => close();

  function dragStart() {
    // Grabbing a closing sheet cancels the close: it follows the finger from where it is.
    measure();
    dragging.current = true;
    anim.current?.stop();
    closing.current = 0;
    fade.set(1);
  }
  const dragMap = (raw: number) => (raw < 0 ? rubberband(raw, height()) : raw);
  function dragRelease(raw: number, velocity: number) {
    dragging.current = false;
    if (commitOnRelease(raw, velocity, height())) close(velocity);
    else anim.current = animate(y, 0, reduced ? FADE : { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
  }
  const release = useRef(dragRelease);
  release.current = dragRelease;
  const start = useRef(dragStart);
  start.current = dragStart;

  const drag = useAxisDrag({ axis: "y", value: y, onStart: dragStart, map: dragMap, onRelease: dragRelease });

  // Pull-down from the content. Touch events, not pointer events: the content's native vertical pan would
  // cancel pointers. Taken over only when the content is at the top and the finger moves mostly down;
  // preventDefault from the first such move, before iOS starts its rubber-band scroll.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    let p: { x: number; y: number; base: number; raw: number; active: boolean; samples: Sample[] } | null = null;
    const atTop = (t: EventTarget | null) => (scrollerOf(t, el)?.scrollTop ?? 0) <= 0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      p = e.touches.length === 1 && t && !dragging.current && atTop(e.target)
        ? { x: t.clientX, y: t.clientY, base: 0, raw: 0, active: false, samples: [] }
        : null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!p || !t) return;
      const dx = t.clientX - p.x, dy = t.clientY - p.y;
      if (!p.active) {
        if (dy < 0 || Math.abs(dx) > dy) {
          // Scrolling the content, or a sideways swipe (swipe-back): not ours, once it's clearly that.
          if (Math.max(Math.abs(dx), -dy) >= SLOP) p = null;
          return;
        }
        // Nothing is prevented until the pull is past the slop: a tap drifts a pixel or two, and iOS gives
        // a touch sequence no click once one of its moves has been prevented, so preventing before the
        // gesture is a drag eats the tap. There's no rubber-band to beat in the meantime — the sheet's
        // scroller sets overscroll-behavior: none, so iOS has no overscroll of its own to start.
        if (dy < SLOP) return;
        p.active = true;
        start.current();
        p.base = y.get();
      }
      e.preventDefault();
      p.raw = p.base + dy;
      p.samples.push({ t: performance.now(), v: p.raw });
      y.set(dragMap(p.raw));
    };
    const onEnd = () => {
      const d = p;
      p = null;
      if (!d?.active) return;
      d.samples.push({ t: performance.now(), v: d.raw });
      release.current(d.raw, velocityFrom(d.samples));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // dragMap reads only height(); the start/release refs carry the latest closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }

  return (
    <div className={styles.layer}>
      <motion.div className={styles.scrim} style={{ opacity: scrimOpacity }} onClick={() => close()} aria-hidden="true" />
      <motion.div
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.sheet}
        style={{ y, opacity: reduced ? fade : 1 }}
        onKeyDown={onKeyDown}
      >
        <div className={styles.handle} data-testid="sheet-handle" {...drag}>
          <div className={styles.grabber} aria-hidden="true" />
          <header className={styles.header}>
            <div className={styles.lead}>
              {onBack && (
                <button type="button" className={styles.back} onClick={onBack}>
                  <ChevronLeft aria-hidden="true" size={22} />
                  <span className={styles.backLabel}>{backLabel}</span>
                </button>
              )}
            </div>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            <div className={styles.trail}>
              {headerAction}
              <Button variant="ghost" onClick={() => close()}>Done</Button>
            </div>
          </header>
        </div>
        <div ref={body} className={styles.body}>{children}</div>
      </motion.div>
    </div>
  );
}
