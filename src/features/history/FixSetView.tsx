import { useState } from "react";
import { DIFFICULTIES, DIFFICULTY_LABEL, difficultyOf, rirFor, type Difficulty } from "../../domain/difficulty";
import type { SetRef } from "../../domain/log";
import type { SetEntry } from "../../domain/types";
import { useApp } from "../../state/context";
import { Button } from "../../ui/Button";
import { ListGroup, ListItem } from "../../ui/ListRow";
import { NumberField } from "../../ui/NumberField";
import { Segmented } from "../../ui/Segmented";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import logStyles from "../log/Log.module.css";
import styles from "./History.module.css";

/** Fix one past set: weight, reps, warm-up or difficulty. Save goes back to the exercise's sets. */
function FixSet({ setRef, set }: { setRef: SetRef; set: SetEntry }) {
  const nav = useSheetNav();
  const unit = useApp((s) => s.doc.settings.unit);
  const editSet = useApp((s) => s.editSet);
  const [weight, setWeight] = useState<number | null>(set.weight);
  const [reps, setReps] = useState<number | null>(set.reps);
  const [warmup, setWarmup] = useState(set.warmup);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(set.rir == null ? null : difficultyOf(set.rir));
  const ready = weight !== null && reps !== null && reps > 0 && (warmup || difficulty !== null || set.rir === null);

  async function save() {
    if (!ready) return;
    const rir = warmup ? null : difficulty ? rirFor(difficulty) : null;
    if (await editSet(setRef, { weight: weight!, reps: reps!, warmup, rir })) nav.pop();
  }

  return (
    <ListGroup title="Set">
      <ListItem>
        <NumberField label={`Weight, ${unit}`} value={weight} min={0} onChange={setWeight} />
        <NumberField label="Reps" value={reps} min={1} integer onChange={setReps} />
        <button type="button" className={logStyles.toggle} aria-pressed={warmup} onClick={() => setWarmup((w) => !w)}>Warm-up</button>
        <Segmented<Difficulty>
          label="Difficulty"
          value={warmup ? null : difficulty}
          options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
          onChange={(d) => {
            setDifficulty(d);
            setWarmup(false);
          }}
        />
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => nav.pop()}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={() => void save()}>Save</Button>
        </div>
      </ListItem>
    </ListGroup>
  );
}

export const fixSetView = (setRef: SetRef, set: SetEntry, label: string): SheetView => ({
  id: `fix-${setRef.blockId}-${setRef.index}`,
  title: label === "W" ? "Warm-up" : `Set ${label}`,
  render: () => <FixSet setRef={setRef} set={set} />,
});
