import { DIFFICULTY_LABEL, difficultyOf } from "../../domain/difficulty";
import type { Block, SetEntry } from "../../domain/types";
import { SwipeRow } from "../../ui/SwipeRow";
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
  const feel = set.warmup ? "Warm-up" : set.rir == null ? "" : DIFFICULTY_LABEL[difficultyOf(set.rir)];
  return (
    <SwipeRow as="li" className={styles.setItem} onRemove={onRemove}>
      <button type="button" className={styles.set} data-set-row aria-current={editing || undefined} onClick={onEdit}>
        <span className={styles.setNo}>{label}</span>
        <span className={styles.setLoad}>{`${set.weight} × ${set.reps}`}</span>
        <span className={styles.setFeel}>{feel}</span>
      </button>
    </SwipeRow>
  );
}
