import { useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotionConfig } from "motion/react";
import { DIFFICULTY_LABEL, difficultyOf } from "../../domain/difficulty";
import type { Block, SetEntry } from "../../domain/types";
import { FLICK, commitOnRelease, rubberband } from "../../ui/gesture";
import { FADE, SPRING } from "../../ui/motion";
import { useAxisDrag } from "../../ui/useAxisDrag";
import styles from "./Log.module.css";

/** "W" for a warm-up, else the working set's number. */
export function setLabels(block: Block | undefined): string[] {
  let n = 0;
  return (block?.sets ?? []).map((s) => (s.warmup ? "W" : String(++n)));
}

/** Today's sets for one exercise: tap one to fix it, swipe it left to remove it. */
export function SetList({ block, editingIndex, onEdit, onRemove }: {
  block: Block | undefined;
  editingIndex?: number | null;
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  if (!block?.sets.length) return null;
  const labels = setLabels(block);
  return (
    <ol className={styles.sets} aria-label="Sets today">
      {block.sets.map((s, i) => (
        <SetRow
          key={`${block.id}:${i}:${s.weight}:${s.reps}`}
          set={s}
          label={labels[i]!}
          editing={editingIndex === i}
          onEdit={() => onEdit?.(i)}
          onRemove={() => onRemove?.(i)}
        />
      ))}
    </ol>
  );
}

function SetRow({ set, label, editing, onEdit, onRemove }: { set: SetEntry; label: string; editing: boolean; onEdit: () => void; onRemove: () => void }) {
  const reduced = useReducedMotionConfig() ?? false;
  const x = useMotionValue(0);
  const fade = useMotionValue(1);
  const ref = useRef<HTMLLIElement>(null);
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
        void out.then(onRemove);
      } else {
        animate(x, 0, reduced ? FADE : { ...SPRING.default, velocity });
      }
    },
  });

  const feel = set.warmup ? "Warm-up" : set.rir == null ? "" : DIFFICULTY_LABEL[difficultyOf(set.rir)];
  return (
    <li ref={ref} className={styles.setItem} {...drag}>
      <motion.button
        type="button"
        className={styles.set}
        style={{ x, opacity: fade }}
        aria-current={editing || undefined}
        onClick={() => {
          // The end of a drag isn't a tap.
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onEdit();
        }}
      >
        <span className={styles.setNo}>{label}</span>
        <span className={styles.setLoad}>{`${set.weight} × ${set.reps}`}</span>
        <span className={styles.setFeel}>{feel}</span>
      </motion.button>
    </li>
  );
}
