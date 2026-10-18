import { libraryState } from "../../domain/exercises";
import type { LibraryExercise } from "../../domain/library";
import { useApp, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { ListGroup, ListRow } from "../../ui/ListRow";
import { Pill } from "../../ui/Pill";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import { useLibraryFlow } from "./flow";
import styles from "./Exercises.module.css";

/** One library entry: tap to add; already added shows "Added"; archived offers Restore. */
export function EntryRow({ entry }: { entry: LibraryExercise }) {
  // Select the doc, derive outside: a selector returning a new object each call would re-render forever.
  const doc = useApp((s) => s.doc);
  const state = libraryState(doc, entry.id);
  const addFromLibrary = useApp((s) => s.addFromLibrary);
  const showToast = useUi((s) => s.showToast);
  const nav = useSheetNav();
  const flow = useLibraryFlow();
  async function add(verb: "Added" | "Restored") {
    const id = await addFromLibrary(entry);
    if (id) {
      nav.popTo(flow.returnTo);
      showToast({ text: `${verb} ${entry.name}` });
      flow.onAdded?.(id);
    }
  }
  if (state.status === "added") return <ListRow label={entry.name} disabled trailing={<Pill tone="accent">Added</Pill>} />;
  if (state.status === "archived") {
    return (
      <ListRow label={entry.name}>
        <Button variant="ghost" aria-label={`Restore ${entry.name}`} onClick={() => void add("Restored")}>Restore</Button>
      </ListRow>
    );
  }
  return <ListRow label={entry.name} onPress={() => void add("Added")} />;
}

export function ChooseEquipmentView({ entries }: { entries: LibraryExercise[] }) {
  return (
    <div className={styles.view}>
      <ListGroup title="Equipment">
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </ListGroup>
    </div>
  );
}

export const chooseEquipmentView = (movement: string, entries: LibraryExercise[]): SheetView => ({
  id: `choose-${movement}`,
  title: movement,
  render: () => <ChooseEquipmentView entries={entries} />,
});
