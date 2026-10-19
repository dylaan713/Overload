import { useMemo, useState } from "react";
import { capitalize } from "../../app/format";
import { groupByRegion } from "../../domain/exercises";
import { equipmentLabel } from "../../domain/library";
import { MUSCLE_LABEL } from "../../domain/library/muscles";
import { logDayFor } from "../../domain/log";
import { weeklyVolume } from "../../domain/volume";
import type { Exercise } from "../../domain/types";
import { useApp, useAppStore, useUi, useUiStore } from "../../state/context";
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
export function NextExerciseView({ onPick, search = false }: { onPick: (exerciseId: string) => void; search?: boolean }) {
  const doc = useApp((s) => s.doc);
  const day = useLogDay();
  const nav = useSheetNav();
  const [query, setQuery] = useState("");

  const queue = useUi((s) => s.log.queue);
  const inHand = useUi((s) => (s.log.draft?.day === day ? s.log.draft.exerciseId : null));
  const upNext = useMemo(() => {
    if (!queue || queue.day !== day) return [];
    const byId = new Map(doc.exercises.map((e) => [e.id, e]));
    const logged = new Set(doc.sessions.filter((s) => s.date === day).flatMap((s) => s.blocks.filter((b) => b.sets.length).map((b) => b.exerciseId)));
    return queue.ids
      .filter((id) => id !== inHand && !logged.has(id))
      .map((id) => byId.get(id))
      .filter((e): e is Exercise => !!e && !e.archived);
  }, [queue, day, doc, inHand]);
  const volume = useMemo(() => weeklyVolume(doc, day), [doc, day]);
  const short = volume.filter((r) => r.status === "under").sort((a, b) => b.low - b.sets - (a.low - a.sets));
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const mine = doc.exercises.filter((e) => !e.archived && tokens.every((t) => e.name.toLowerCase().includes(t)));
  const groups = groupByRegion(mine);

  return (
    <div className={styles.picker}>
      {upNext.length > 0 && (
        <ListGroup title="Up next">
          {upNext.map((e) => <ListRow key={e.id} label={e.name} subtitle={subtitle(e)} onPress={() => onPick(e.id)} />)}
        </ListGroup>
      )}
      {/* Nothing trained lately: no muscles to be short or on track. */}
      {volume.length > 0 && <ListGroup title="Still short this week">
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
                  <span className={styles.volumeCount} aria-hidden="true">{`${fmt(r.sets)}/${r.low}`}</span>
                  <span className={styles.srOnly}>{`${fmt(r.sets)} of ${r.low} sets`}</span>
                </li>
              ))}
            </ul>
          </ListItem>
        )}
      </ListGroup>}

      <Input
        type="search"
        aria-label="Search your exercises"
        placeholder="Search your exercises"
        value={query}
        data-autofocus={search || undefined}
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

export const nextExerciseView = (onPick: (exerciseId: string) => void, search = false): SheetView => ({
  id: NEXT_EXERCISE_VIEW_ID,
  title: "Next exercise",
  render: () => <NextExerciseView onPick={onPick} search={search} />,
});

/** The sheet: picking (or adding one from the library) makes it the Log's current exercise and closes. */
export function NextExerciseSheet({ search = false, onClose }: { search?: boolean; onClose: () => void }) {
  const app = useAppStore();
  const ui = useUiStore();
  const [close] = useState(() => ({ current: null as (() => void) | null }));
  // Read the stores at pick time: an exercise added from the library a moment ago must be seen.
  const [pick] = useState(() => (exerciseId: string) => {
    const { doc, today } = app.getState();
    const { log, now, setDraft, focusEntryAfterSheet, unqueue } = ui.getState();
    const day = logDayFor(doc, today(), now(), log.last);
    // Re-picking the exercise already in hand keeps what's typed.
    if (log.draft?.day !== day || log.draft.exerciseId !== exerciseId) setDraft(freshDraft(doc, day, exerciseId));
    unqueue(exerciseId);
    focusEntryAfterSheet();
    close.current?.();
  });
  // With no exercises of my own yet there's nothing to pick from: start in the library search.
  const [root] = useState(() => (app.getState().doc.exercises.some((e) => !e.archived) ? nextExerciseView(pick, search) : addExerciseView()));
  return (
    <LibraryFlow.Provider value={{ returnTo: NEXT_EXERCISE_VIEW_ID, onAdded: pick }}>
      <SheetStack root={root} onClose={onClose} closeRef={close} />
    </LibraryFlow.Provider>
  );
}
