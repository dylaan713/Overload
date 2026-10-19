import { useMemo, useState } from "react";
import { blockFor, sessionOn } from "../../domain/log";
import type { Block } from "../../domain/types";
import { useApp, useAppStore, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { ListGroup, ListRow } from "../../ui/ListRow";
import { SheetStack, useSheetNav, type SheetView } from "../../ui/SheetStack";
import { SetList, setLabels } from "../log/SetList";
import { fixSetView } from "./FixSetView";
import styles from "./History.module.css";

export const workoutTitle = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const working = (b: Block) => b.sets.filter((s) => !s.warmup).map((s) => `${s.weight} × ${s.reps}`).join(", ") || "Warm-ups only";

/** One exercise's sets that day: tap to fix, swipe to remove (with Undo). */
function BlockSets({ date, exerciseId }: { date: string; exerciseId: string }) {
  const nav = useSheetNav();
  const app = useAppStore();
  const block = useApp((s) => blockFor(s.doc, date, exerciseId));
  const removeSet = useApp((s) => s.removeSet);
  const restoreSet = useApp((s) => s.restoreSet);
  const showToast = useUi((s) => s.showToast);
  if (!block) return <EmptyState text="No sets left for this exercise on this day." />;
  const labels = setLabels(block);

  // By the set itself: positions shift as sets are removed and restored.
  async function remove(set: Block["sets"][number]): Promise<boolean> {
    const current = blockFor(app.getState().doc, date, exerciseId);
    const index = current ? current.sets.indexOf(set) : -1;
    if (!current || index < 0) return false;
    const label = setLabels(current)[index]!;
    const removed = await removeSet({ day: date, blockId: current.id, index });
    if (!removed) return false;
    showToast({ text: label === "W" ? "Removed warm-up" : `Removed set ${label}`, action: { label: "Undo", onAction: () => void restoreSet(removed) } });
    return true;
  }

  return (
    <SetList
      block={block}
      label="Sets"
      onEdit={(i) => nav.push(fixSetView({ day: date, blockId: block.id, index: i }, block.sets[i]!, labels[i]!))}
      onRemove={remove}
    />
  );
}

/** A past workout: each exercise with its working sets, and Repeat at the bottom. */
function Workout({ date, onRepeat }: { date: string; onRepeat: (date: string) => void }) {
  const nav = useSheetNav();
  const session = useApp((s) => sessionOn(s.doc, date));
  const exercises = useApp((s) => s.doc.exercises);
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);
  const blocks = session?.blocks.filter((b) => b.sets.length) ?? [];
  if (blocks.length === 0) return <EmptyState text="Nothing logged on this day." />;
  return (
    <>
      <ListGroup title="Exercises">
        {blocks.map((b) => {
          const name = names.get(b.exerciseId) ?? "Exercise";
          return (
            <ListRow
              key={b.id}
              label={name}
              subtitle={working(b)}
              onPress={() => nav.push({ id: `block-${b.id}`, title: name, render: () => <BlockSets date={date} exerciseId={b.exerciseId} /> })}
            />
          );
        })}
      </ListGroup>
      <div className={styles.repeat}>
        <Button variant="primary" block onClick={() => onRepeat(date)}>Repeat this workout</Button>
      </div>
    </>
  );
}

const workoutView = (date: string, onRepeat: (date: string) => void): SheetView => ({
  id: `workout-${date}`,
  title: workoutTitle(date),
  render: () => <Workout date={date} onRepeat={onRepeat} />,
});

/** Opened from History: view, fix and remove a past workout's sets, or repeat it. */
export function WorkoutSheet({ date, onClose, onRepeat = () => {} }: { date: string; onClose: () => void; onRepeat?: (date: string) => void }) {
  const [root] = useState(() => workoutView(date, onRepeat));
  return <SheetStack root={root} onClose={onClose} />;
}
