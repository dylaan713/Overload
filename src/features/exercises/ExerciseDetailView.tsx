import { useState } from "react";
import { capitalize, plural } from "../../app/format";
import { sessionsWithExercise } from "../../domain/exercises";
import { equipmentLabel } from "../../domain/library";
import { loadStep } from "../../domain/settings";
import type { LiftClass, Muscle } from "../../domain/types";
import { useApp, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Field, Input, fieldErrorId } from "../../ui/Field";
import { ListGroup, ListItem } from "../../ui/ListRow";
import { NumberField } from "../../ui/NumberField";
import { Segmented } from "../../ui/Segmented";
import { useSheetNav, type SheetView } from "../../ui/SheetStack";
import { EquipmentSelect, MuscleFields } from "./fields";
import { LIBRARY_VIEW_ID } from "./ids";
import styles from "./Exercises.module.css";

export function ExerciseDetailView({ id }: { id: string }) {
  const doc = useApp((s) => s.doc);
  const updateExercise = useApp((s) => s.updateExercise);
  const setArchived = useApp((s) => s.setArchived);
  const deleteExercise = useApp((s) => s.deleteExercise);
  const showToast = useUi((s) => s.showToast);
  const nav = useSheetNav();
  const ex = doc.exercises.find((e) => e.id === id);
  const [name, setName] = useState(ex?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [muscleError, setMuscleError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!ex) return <EmptyState text="This exercise was deleted." />;
  const unit = doc.settings.unit;

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) return setNameError("Name can't be empty");
    setNameError(null);
    if (trimmed !== ex!.name) void updateExercise(id, { name: trimmed });
  }

  function setPrimary(primary: Muscle[]) {
    if (primary.length === 0) return setMuscleError("Pick at least one muscle worked");
    setMuscleError(null);
    void updateExercise(id, { primary, secondary: ex!.secondary.filter((m) => !primary.includes(m)) });
  }

  async function archive() {
    const label = ex!.name;
    if (!(await setArchived(id, true))) return; // the shell shows the save error
    nav.popTo(LIBRARY_VIEW_ID);
    showToast({ text: `Archived ${label}`, action: { label: "Undo", onAction: () => void setArchived(id, false) } });
  }

  async function remove() {
    const label = ex!.name;
    if (!(await deleteExercise(id))) return;
    nav.popTo(LIBRARY_VIEW_ID);
    showToast({ text: `Deleted ${label}` });
  }

  const sessions = sessionsWithExercise(doc, id);
  return (
    <div className={styles.view}>
      <ListGroup title="Exercise" footer={ex.libraryId ? `From the library · ${capitalize(equipmentLabel(ex.equipment))}` : undefined}>
        <ListItem>
          <Field label="Name" htmlFor="ex-name" error={nameError}>
            <Input
              id="ex-name"
              value={name}
              aria-invalid={nameError ? "true" : undefined}
              aria-describedby={nameError ? fieldErrorId("ex-name") : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </Field>
          {!ex.libraryId && (
            <>
              <EquipmentSelect value={ex.equipment} onChange={(equipment) => void updateExercise(id, { equipment })} />
              <Segmented<LiftClass>
                label="Type"
                value={ex.class}
                options={[{ value: "compound", label: "Compound" }, { value: "isolation", label: "Isolation" }]}
                onChange={(c) => void updateExercise(id, { class: c })}
              />
            </>
          )}
        </ListItem>
      </ListGroup>
      <ListGroup title="Muscles">
        <ListItem>
          <MuscleFields
            primary={ex.primary}
            secondary={ex.secondary}
            onPrimary={setPrimary}
            onSecondary={(secondary) => void updateExercise(id, { secondary })}
            error={muscleError}
          />
        </ListItem>
      </ListGroup>
      <ListGroup title="Loading" footer="Override the equipment's step for this exercise only.">
        <ListItem>
          <div className={styles.inline}>
            <NumberField
              label="Weight step"
              value={ex.step}
              min={0.1}
              optional
              suffix={unit}
              placeholder={`Default (${loadStep({ ...ex, step: null }, doc.settings)} ${unit})`}
              onChange={(step) => void updateExercise(id, { step })}
            />
            {ex.step !== null && <Button variant="ghost" onClick={() => void updateExercise(id, { step: null })}>Use default</Button>}
          </div>
        </ListItem>
      </ListGroup>
      <div className={styles.actions}>
        <Button variant="secondary" block onClick={() => void archive()}>Archive exercise</Button>
        <p className={styles.caption}>Hides it from pickers. Its history stays, and you can restore it.</p>
        {!confirmDelete ? (
          <Button variant="ghost" className={styles.destructive} onClick={() => setConfirmDelete(true)}>Delete permanently…</Button>
        ) : (
          <div className={styles.confirm}>
            <p>
              {sessions > 0
                ? `Deletes ${ex.name} and its ${plural(sessions, "logged session")}. This can't be undone.`
                : `Deletes ${ex.name}. It has no logged sessions.`}
            </p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => void remove()}>Delete</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const exerciseDetailView = (id: string, name: string): SheetView => ({ id: `exercise-${id}`, title: name, render: () => <ExerciseDetailView id={id} /> });
