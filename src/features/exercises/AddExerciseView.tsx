import { useMemo, useState } from "react";
import { LIBRARY, groupByMovement, searchLibrary } from "../../domain/library";
import { Input } from "../../ui/Field";
import { ListGroup, ListRow } from "../../ui/ListRow";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import { EntryRow, chooseEquipmentView } from "./ChooseEquipmentView";
import { createExerciseView } from "./CreateExerciseView";
import styles from "./Exercises.module.css";

/** Search the library on every keystroke; one row per movement, then pick the equipment. */
export function AddExerciseView() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupByMovement(searchLibrary(query)), [query]);
  const nav = useSheetNav();
  return (
    <div className={styles.view}>
      <Input
        type="search"
        aria-label="Search exercises"
        placeholder={`Search ${LIBRARY.length} exercises`}
        className={styles.search}
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 ? (
        <p className={styles.note}>No matches. Create your own instead.</p>
      ) : (
        <ListGroup title={query ? "Matches" : "Library"}>
          {groups.map((g) =>
            g.entries.length === 1 ? (
              <EntryRow key={g.movement} entry={g.entries[0]!} />
            ) : (
              <ListRow key={g.movement} label={g.movement} detail={`${g.entries.length} options`} onPress={() => nav.push(chooseEquipmentView(g.movement, g.entries))} />
            ),
          )}
        </ListGroup>
      )}
      <ListGroup title="Not here?">
        <ListRow label="Can't find it? Create your own" onPress={() => nav.push(createExerciseView())} />
      </ListGroup>
    </div>
  );
}

export const addExerciseView = (): SheetView => ({ id: "add-exercise", title: "Add exercise", render: () => <AddExerciseView /> });
