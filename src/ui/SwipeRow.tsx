import { useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotionConfig } from "motion/react";
import { FLICK, commitOnRelease, rubberband } from "./gesture";
import { FADE, SPRING } from "./motion";
import { useAxisDrag } from "./useAxisDrag";
import styles from "./SwipeRow.module.css";

/**
 * A row you swipe left to remove (apple-design §2, §6, §9). A red Delete is revealed under it as it moves,
 * so the gesture says it's there rather than hiding. Release past half — where the momentum projects to —
 * removes it; anything shorter springs back. The end of a drag is never a tap.
 */
export function SwipeRow({ as: Tag = "div", className, action = "Delete", onRemove, children }: {
  /** The element to render: a list needs `li`. */
  as?: "div" | "li";
  className?: string;
  /** What the revealed panel says. */
  action?: string;
  /** Resolves false when the row wasn't removed (e.g. the save failed), so it comes back instead of leaving a gap. */
  onRemove: () => Promise<boolean>;
  children: ReactNode;
}) {
  const reduced = useReducedMotionConfig() ?? false;
  const x = useMotionValue(0);
  const fade = useMotionValue(1);
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const dragged = useRef(false);
  const width = () => ref.current?.offsetWidth || 320;

  const drag = useAxisDrag({
    axis: "x",
    value: x,
    onStart() {
      dragged.current = true;
      x.stop();
    },
    // Left follows the finger; right resists (there's nothing that way).
    map: (raw) => (raw > 0 ? rubberband(raw, width()) : raw),
    onRelease(raw, velocity) {
      if (commitOnRelease(-raw, -velocity, width())) {
        const out = reduced ? animate(fade, 0, FADE) : animate(x, -width(), { ...(Math.abs(velocity) > FLICK ? SPRING.momentum : SPRING.default), velocity });
        void out.then(async () => {
          if (await onRemove()) return;
          animate(x, 0, reduced ? FADE : SPRING.default);
          animate(fade, 1, FADE);
        });
      } else {
        animate(x, 0, reduced ? FADE : { ...SPRING.default, velocity });
      }
    },
  });

  return (
    <Tag
      ref={ref}
      className={[styles.host, className].filter(Boolean).join(" ")}
      data-swipe-row
      {...drag}
      onPointerDown={(e) => {
        dragged.current = false; // a new press: whether it's a tap is decided afresh
        drag.onPointerDown(e);
      }}
      onClickCapture={(e) => {
        // The end of a drag isn't a tap, whatever is inside the row.
        if (!dragged.current) return;
        dragged.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className={styles.action} aria-hidden="true">{action}</div>
      <motion.div className={styles.front} style={{ x, opacity: fade }}>{children}</motion.div>
    </Tag>
  );
}
