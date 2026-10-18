import { ChevronLeft } from "lucide-react";
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControlsWithThen } from "motion/react";
import { Button } from "./Button";
import { FLICK, commitOnRelease, rubberband } from "./gesture";
import { FADE, SPRING } from "./motion";
import { useAxisDrag } from "./useAxisDrag";
import styles from "./Sheet.module.css";

export interface SheetProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Modal bottom sheet. It slides up on mount and leaves downward along the same path, then calls onClose.
 * Dragging the grabber/header follows the finger 1:1 (rubber-banding upward) and can be grabbed mid-animation;
 * release decides by projected momentum. It writes --sheet-progress (0 open → 1 gone) so the page behind
 * can scale back and dim in step. The caller renders it only while open and marks the page inert.
 */
export function Sheet({ title, onClose, onBack, backLabel, headerAction, children }: SheetProps) {
  const titleId = useId();
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const anim = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const closing = useRef(0); // token of the close in flight; 0 = none
  const tokens = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const height = () => ref.current?.offsetHeight || window.innerHeight;
  const setProgress = (p: number) => document.documentElement.style.setProperty("--sheet-progress", String(clamp01(p)));
  useMotionValueEvent(y, "change", (v) => setProgress(v / height()));
  useMotionValueEvent(fade, "change", (v) => setProgress(1 - v));
  const scrimOpacity = useTransform(() => (reduced ? fade.get() : 1 - clamp01(y.get() / height())));

  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
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
      document.documentElement.style.removeProperty("--sheet-progress");
      opener?.focus();
    };
    // Mount-only: entering is a one-time animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(velocity = 0) {
    if (closing.current) return;
    const token = (closing.current = ++tokens.current);
    // Commit whatever is being typed before the content unmounts.
    if (document.activeElement instanceof HTMLElement && ref.current?.contains(document.activeElement)) document.activeElement.blur();
    anim.current?.stop();
    anim.current = reduced
      ? animate(fade, 0, FADE)
      : animate(y, height(), { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
    anim.current.then(() => {
      if (closing.current === token) onCloseRef.current();
    });
  }

  const drag = useAxisDrag({
    axis: "y",
    value: y,
    onStart() {
      // Grabbing a closing sheet cancels the close: it follows the finger from where it is.
      anim.current?.stop();
      closing.current = 0;
      fade.set(1);
    },
    map: (raw) => (raw < 0 ? rubberband(raw, height()) : raw),
    onRelease(raw, velocity) {
      if (commitOnRelease(raw, velocity, height())) close(velocity);
      else anim.current = animate(y, 0, { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
    },
  });

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
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.sheet}
        style={{ y: reduced ? 0 : y, opacity: reduced ? fade : 1 }}
        onKeyDown={onKeyDown}
      >
        <div className={styles.handle} data-testid="sheet-handle" {...drag}>
          <div className={styles.grabber} aria-hidden="true" />
          <header className={styles.header}>
            <div className={styles.lead}>
              {onBack && (
                <button type="button" className={styles.back} onClick={onBack}>
                  <ChevronLeft aria-hidden="true" size={22} />
                  {backLabel}
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
        <div className={styles.body}>{children}</div>
      </motion.div>
    </div>
  );
}
