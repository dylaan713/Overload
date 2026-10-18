import { useId, useRef, useState } from "react";
import { DIFFICULTIES, DIFFICULTY_LABEL, rirFor, type Difficulty } from "../../domain/difficulty";
import type { SetEntry, Unit } from "../../domain/types";
import { useUi } from "../../state/context";
import type { LogDraft } from "../../state/uiStore";
import { Button } from "../../ui/Button";
import { Field, Input, fieldErrorId } from "../../ui/Field";
import { parseNumber, rangeMessage } from "../../ui/NumberField";
import { Segmented } from "../../ui/Segmented";
import styles from "./Log.module.css";

const WEIGHT_ERROR = rangeMessage(0);
const REPS_ERROR = rangeMessage(1, undefined, true);
const show = (n: number | null) => (n == null ? "" : String(n));

/**
 * Weight, reps, warm-up and difficulty for one set. What's typed lives in the Log draft (saved on every
 * keystroke); an untouched field logs the target shown in it.
 */
export function EntryRow({ day, unit, placeholder, mode, onSubmit, onCancel, onDelete }: {
  day: string;
  unit: Unit;
  placeholder: { weight: number | null; reps: number | null };
  mode: "new" | "edit";
  onSubmit: (set: SetEntry) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const draft = useUi((s) => s.log.draft);
  const setDraft = useUi((s) => s.setDraft);
  const weightId = useId();
  const repsId = useId();
  const weightRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ weight?: string; reps?: string }>({});

  const weightText = draft?.weight ?? "";
  const repsText = draft?.reps ?? "";
  const warmup = draft?.warmup ?? false;
  const difficulty = draft?.difficulty ?? null;
  const update = (patch: Omit<Partial<LogDraft>, "day">) => setDraft({ day, ...patch });

  function submit() {
    const weight = weightText.trim() ? parseNumber(weightText.trim()) : placeholder.weight;
    const reps = repsText.trim() ? parseNumber(repsText.trim()) : placeholder.reps;
    const next = {
      weight: weight == null || weight < 0 ? WEIGHT_ERROR : undefined,
      reps: reps == null || reps < 1 || !Number.isInteger(reps) ? REPS_ERROR : undefined,
    };
    setErrors(next);
    if (next.weight) return weightRef.current?.focus();
    if (next.reps) return repsRef.current?.focus();
    onSubmit({ weight: weight!, reps: reps!, warmup, rir: warmup ? null : rirFor(difficulty!) });
  }

  const ready = warmup || difficulty !== null;
  return (
    <form
      className={styles.entry}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) submit();
      }}
    >
      <div className={styles.inputs}>
        <Field label={unit} htmlFor={weightId} error={errors.weight}>
          <Input
            ref={weightRef}
            id={weightId}
            className={styles.number}
            inputMode="decimal"
            autoComplete="off"
            value={weightText}
            placeholder={show(placeholder.weight)}
            aria-invalid={errors.weight ? "true" : undefined}
            aria-describedby={errors.weight ? fieldErrorId(weightId) : undefined}
            onChange={(e) => {
              update({ weight: e.target.value });
              setErrors((x) => ({ ...x, weight: undefined }));
            }}
          />
        </Field>
        <Field label="Reps" htmlFor={repsId} error={errors.reps}>
          <Input
            ref={repsRef}
            id={repsId}
            className={styles.number}
            inputMode="numeric"
            autoComplete="off"
            value={repsText}
            placeholder={show(placeholder.reps)}
            aria-invalid={errors.reps ? "true" : undefined}
            aria-describedby={errors.reps ? fieldErrorId(repsId) : undefined}
            onChange={(e) => {
              update({ reps: e.target.value });
              setErrors((x) => ({ ...x, reps: undefined }));
            }}
          />
        </Field>
      </div>
      <button type="button" className={styles.toggle} aria-pressed={warmup} onClick={() => update({ warmup: !warmup })}>
        Warm-up
      </button>
      {!warmup && (
        <Segmented<Difficulty>
          label="Difficulty"
          value={difficulty}
          options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
          onChange={(d) => update({ difficulty: d })}
        />
      )}
      {mode === "new" ? (
        <Button type="submit" variant="primary" block disabled={!ready}>Log set</Button>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!ready}>Save</Button>
          <Button variant="danger" onClick={onDelete}>Delete set</Button>
        </div>
      )}
    </form>
  );
}
