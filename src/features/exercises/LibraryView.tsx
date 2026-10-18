import { Plus } from "lucide-react";
import { capitalize, plural } from "../../app/format";
import { groupByRegion } from "../../domain/exercises";
import { equipmentLabel } from "../../domain/library";
import { MUSCLE_LABEL } from "../../domain/library/muscles";
import type { Exercise } from "../../domain/types";
import { useApp } from "../../state/context";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { ListGroup, ListRow } from "../../ui/ListRow";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import { addExerciseView } from "./AddExerciseView";
import { exerciseDetailView } from "./ExerciseDetailView";
import { LIBRARY_VIEW_ID } from "./ids";
import styles from "./Exercises.module.css";

const subtitle = (e: Exercise) => `${capitalize(equipmentLabel(e.equipment))} · ${e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}`;

function AddAction() {
  const nav = useSheetNav();
  return (
    <IconButton label="Add exercise" onClick={() => nav.push(addExerciseView())}>
      <Plus aria-hidden="true" size={22} />
    </IconButton>
  );
}

/** My exercises by body region, with Add in the header and archived ones one level down. */
export function LibraryView() {
  const exercises = useApp((s) => s.doc.exercises);
  const nav = useSheetNav();
  const groups = groupByRegion(exercises);
  const archived = exercises.filter((e) => e.archived).length;
  return (
    <div className={styles.view}>
      {groups.length === 0 && (
        <div className={styles.empty}>
          <EmptyState text="No exercises yet. Add one from the library." />
          <Button variant="primary" block onClick={() => nav.push(addExerciseView())}>Add exercise</Button>
        </div>
      )}
      {groups.map((g) => (
        <ListGroup key={g.region} title={g.region}>
          {g.exercises.map((e) => (
            <ListRow key={e.id} label={e.name} subtitle={subtitle(e)} onPress={() => nav.push(exerciseDetailView(e.id, e.name))} />
          ))}
        </ListGroup>
      ))}
      {archived > 0 && (
        <ListGroup title="More">
          <ListRow label={`Archived (${archived})`} onPress={() => nav.push(archivedView())} />
        </ListGroup>
      )}
    </div>
  );
}

function ArchivedView() {
  const exercises = useApp((s) => s.doc.exercises);
  const setArchived = useApp((s) => s.setArchived);
  const groups = groupByRegion(exercises, { archived: true });
  if (groups.length === 0) return <EmptyState text="Nothing archived." />;
  return (
    <div className={styles.view}>
      {groups.map((g) => (
        <ListGroup key={g.region} title={g.region} footer={undefined}>
          {g.exercises.map((e) => (
            <ListRow key={e.id} label={e.name}>
              <Button variant="ghost" aria-label={`Restore ${e.name}`} onClick={() => void setArchived(e.id, false)}>Restore</Button>
            </ListRow>
          ))}
        </ListGroup>
      ))}
      <p className={styles.caption}>{`Archived exercises keep their history. ${plural(exercises.filter((e) => e.archived).length, "exercise")} archived.`}</p>
    </div>
  );
}

const archivedView = (): SheetView => ({ id: "archived", title: "Archived", render: () => <ArchivedView /> });

export const libraryView = (): SheetView => ({ id: LIBRARY_VIEW_ID, title: "Exercise library", headerAction: <AddAction />, render: () => <LibraryView /> });
