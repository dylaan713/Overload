import { useRef } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotionConfig } from "motion/react";
import { commitOnRelease } from "./gesture";
import { SPRING } from "./motion";
import { useAxisDrag } from "./useAxisDrag";
import styles from "./Toast.module.css";

export interface ToastData {
  id: string;
  text: string;
  action?: { label: string; onAction(): void };
}

/** Enters from the bottom and leaves the same way; a downward swipe dismisses it. */
export function ToastView({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  const reduced = useReducedMotionConfig() ?? false;
  return (
    <div role="status" aria-live="polite" className={styles.region}>
      <AnimatePresence initial={false}>
        {toast && <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} reduced={reduced} />}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss, reduced }: { toast: ToastData; onDismiss: () => void; reduced: boolean }) {
  const drag = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);
  const travel = reduced ? 0 : 24;
  const handlers = useAxisDrag({
    axis: "y",
    value: drag,
    map: (raw) => Math.max(0, raw),
    onRelease(raw, velocity) {
      if (commitOnRelease(raw, velocity, ref.current?.offsetHeight || 64)) onDismiss();
      else animate(drag, 0, { ...SPRING.default, velocity });
    },
  });
  return (
    <motion.div
      initial={{ y: travel, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: travel, opacity: 0 }}
      transition={SPRING.snappy}
      className={styles.outer}
    >
      <motion.div ref={ref} className={styles.toast} style={{ y: drag }} {...handlers}>
        <span className={styles.text}>{toast.text}</span>
        {toast.action && (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              // Dismiss first, so an action can show a follow-up toast without it being cleared.
              onDismiss();
              toast.action!.onAction();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
