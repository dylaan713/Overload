import { useMemo, useState } from "react";
import { capitalize } from "../../app/format";
import { groupByRegion } from "../../domain/exercises";
import { equipmentLabel } from "../../domain/library";
import { MUSCLE_LABEL } from "../../domain/library/muscles";
import { logDayFor } from "../../domain/log";
import { weeklyVolume } from "../../domain/volume";
import type { Exercise } from "../../domain/types";
import { useApp, useAppStore, useUiStore } from "../../state/context";
import { Input } from "../../ui/Field";
import { ListGroup, ListItem, ListRow } from "../../ui/ListRow";
import { SheetStack, useSheetNav, type SheetView } from "../../ui/SheetStack";
import { addExerciseView } from "../exercises/AddExerciseView";
import { LibraryFlow } from "../exercises/flow";
import { freshDraft, useLogDay } from "./draft";
import styles from "./Log.module.css";

export const NEXT_EXERCISE_VIEW_ID = "next-exercise";

const subtitle = (e: Exercise) => `${capitalize(equipmentLabel(e.equipment))} · ${e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}`;
const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Muscles still under this week's range, then my exercises to pick from. No suggestions: Dylan picks. */
export function NextExerciseView({ onPick }: { onPick: (exerciseId: string) => void }) {
  const doc = useApp((s) => s.doc);
  const day = useLogDay();
  const nav = useSheetNav();
  const [query, setQuery] = useState("");

  const short = useMemo(
    () => weeklyVolume(doc, day).filter((r) => r.status === "under").sort((a, b) => b.low - b.sets - (a.low - a.sets)),
    [doc, day],
  );
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const mine = doc.exercises.filter((e) => !e.archived && tokens.every((t) => e.name.toLowerCase().includes(t)));
  const groups = groupByRegion(mine);

  return (
    <div className={styles.picker}>
      <ListGroup title="Still short this week">
        {short.length === 0 ? (
          <ListItem>
            <p className={styles.note}>Every muscle you train is on track this week</p>
          </ListItem>
        ) : (
          <ListItem>
            <ul className={styles.volume}>
              {short.map((r) => (
                <li key={r.muscle} className={styles.volumeRow}>
                  <span>{r.label}</span>
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (r.sets / r.low) * 100)}%` }} />
                  </span>
                  <span className={styles.volumeCount}>{`${fmt(r.sets)}/${r.low}`}</span>
                </li>
              ))}
            </ul>
          </ListItem>
        )}
      </ListGroup>

      <Input
        type="search"
        aria-label="Search your exercises"
        placeholder="Search your exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.map((g) => (
        <ListGroup key={g.region} title={g.region}>
          {g.exercises.map((e) => (
            <ListRow key={e.id} label={e.name} subtitle={subtitle(e)} onPress={() => onPick(e.id)} />
          ))}
        </ListGroup>
      ))}
      <ListGroup title="Not here?">
        <ListRow label="Add from the library" onPress={() => nav.push(addExerciseView())} />
      </ListGroup>
    </div>
  );
}

export const nextExerciseView = (onPick: (exerciseId: string) => void): SheetView => ({
  id: NEXT_EXERCISE_VIEW_ID,
  title: "Next exercise",
  render: () => <NextExerciseView onPick={onPick} />,
});

/** The sheet: picking (or adding one from the library) makes it the Log's current exercise and closes. */
export function NextExerciseSheet({ onClose }: { onClose: () => void }) {
  const app = useAppStore();
  const ui = useUiStore();
  const [close] = useState(() => ({ current: null as (() => void) | null }));
  // Read the stores at pick time: an exercise added from the library a moment ago must be seen.
  const [pick] = useState(() => (exerciseId: string) => {
    const { doc, today } = app.getState();
    const { log, now, setDraft } = ui.getState();
    setDraft(freshDraft(doc, logDayFor(doc, today(), now(), log.last), exerciseId));
    close.current?.();
  });
  const [root] = useState(() => nextExerciseView(pick));
  return (
    <LibraryFlow.Provider value={{ returnTo: NEXT_EXERCISE_VIEW_ID, onAdded: pick }}>
      <SheetStack root={root} onClose={onClose} closeRef={close} />
    </LibraryFlow.Provider>
  );
}
