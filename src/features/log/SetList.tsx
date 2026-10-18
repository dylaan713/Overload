import { DIFFICULTY_LABEL, difficultyOf } from "../../domain/difficulty";
import type { Block } from "../../domain/types";
import styles from "./Log.module.css";

/** Today's sets for one exercise: warm-ups marked W, working sets numbered with how they felt. */
export function SetList({ block }: { block: Block | undefined }) {
  if (!block?.sets.length) return null;
  let n = 0;
  return (
    <ol className={styles.sets} aria-label="Sets today">
      {block.sets.map((s, i) => {
        const label = s.warmup ? "W" : String(++n);
        return (
          <li key={i} className={styles.set}>
            <span className={styles.setNo}>{label}</span>
            <span className={styles.setLoad}>{`${s.weight} × ${s.reps}`}</span>
            <span className={styles.setFeel}>{s.warmup ? "Warm-up" : s.rir == null ? "" : DIFFICULTY_LABEL[difficultyOf(s.rir)]}</span>
          </li>
        );
      })}
    </ol>
  );
}
