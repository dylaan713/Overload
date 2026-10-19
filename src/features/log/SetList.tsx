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

// Sets have no ids; their objects are stable across saves (changes copy only what changed), so they key rows.
const keys = new WeakMap<SetEntry, number>();
let nextKey = 0;
const keyOf = (s: SetEntry) => {
  if (!keys.has(s)) keys.set(s, ++nextKey);
  return keys.get(s)!;
};

/**
 * Today's sets for one exercise: tap one to fix it, swipe it left to remove it. Removal is by the set itself,
 * not its position, so two quick swipes can't hit a row that moved up in between.
 */
export function SetList({ block, label = "Sets today", editingIndex, onEdit, onRemove }: {
  block: Block | undefined;
  label?: string;
  editingIndex?: number | null;
  onEdit?: (index: number) => void;
  /** Resolves false when the set wasn't removed, so the row comes back. */
  onRemove?: (set: SetEntry) => Promise<boolean>;
}) {
  if (!block?.sets.length) return null;
  const labels = setLabels(block);
  return (
    <ol className={styles.sets} aria-label={label}>
      {block.sets.map((s, i) => (
        <SetRow
          key={keyOf(s)}
          set={s}
          label={labels[i]!}
          editing={editingIndex === i}
          onEdit={() => onEdit?.(i)}
          onRemove={() => onRemove?.(s) ?? Promise.resolve(false)}
        />
      ))}
    </ol>
  );
}

function SetRow({ set, label, editing, onEdit, onRemove }: { set: SetEntry; label: string; editing: boolean; onEdit: () => void; onRemove: () => Promise<boolean> }) {
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
        void out.then(async () => {
          if (await onRemove()) return;
          // Not removed (e.g. the save failed): bring it back rather than leave a gap.
          animate(x, 0, reduced ? FADE : SPRING.default);
          animate(fade, 1, FADE);
        });
      } else {
        animate(x, 0, reduced ? FADE : { ...SPRING.default, velocity });
      }
    },
  });

  const feel = set.warmup ? "Warm-up" : set.rir == null ? "" : DIFFICULTY_LABEL[difficultyOf(set.rir)];
  return (
    <li
      ref={ref}
      className={styles.setItem}
      {...drag}
      onPointerDown={(e) => {
        dragged.current = false; // a new press: whether it's a tap is decided afresh
        drag.onPointerDown(e);
      }}
    >
      <motion.button
        type="button"
        className={styles.set}
        data-set-row
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
