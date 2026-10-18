import { useEffect, useId, useState } from "react";
import { capitalize } from "../../app/format";
import { DIFFICULTIES, DIFFICULTY_LABEL, difficultyOf, rirFor, type Difficulty } from "../../domain/difficulty";
import { phaseOf } from "../../domain/settings";
import type { ClassRules, Style, StyleRules } from "../../domain/types";
import { useApp } from "../../state/context";
import { Field, Select } from "../../ui/Field";
import { ListGroup, ListItem } from "../../ui/ListRow";
import { NumberField } from "../../ui/NumberField";
import { Segmented } from "../../ui/Segmented";
import styles from "./Settings.module.css";

type Pair = [low: keyof ClassRules, high: keyof ClassRules];
const PAIRS: Pair[] = [["repLow", "repHigh"], ["rirLow", "rirHigh"]];

/** Edit the rules for each style. Pairs are checked here, so the store only ever receives valid rules. */
export function StyleRulesView() {
  const settings = useApp((s) => s.doc.settings);
  const today = useApp((s) => s.today)();
  const updateSettings = useApp((s) => s.updateSettings);
  const current = phaseOf(settings, today).style;
  const [style, setStyle] = useState<Style>(current);
  const order: Style[] = current === "strength" ? ["strength", "hypertrophy"] : ["hypertrophy", "strength"];
  const rules = settings.styles[style];
  const save = (next: StyleRules) => updateSettings((s) => ({ ...s, styles: { ...s.styles, [style]: next } }));

  return (
    <div className={styles.view}>
      <Segmented label="Style" value={style} options={order.map((s) => ({ value: s, label: s === current ? `${capitalize(s)} (current)` : capitalize(s) }))} onChange={setStyle} />
      <ClassSection key={`${style}-compound`} title="Compound" rules={rules.compound} onSave={(c) => save({ ...rules, compound: c })} />
      <ClassSection key={`${style}-isolation`} title="Isolation" rules={rules.isolation} onSave={(c) => save({ ...rules, isolation: c })} />
      <VolumeSection key={`${style}-volume`} volume={rules.volume} onSave={(v) => save({ ...rules, volume: v })} />
    </div>
  );
}

const pairsValid = <T extends object>(r: T, pairs: [keyof T, keyof T][]) => !pairs.some(([lo, hi]) => r[lo] > r[hi]);

/**
 * The fields show a draft, so a refused low/high value stays on screen (flagged) instead of silently
 * reverting while its partner saves. The draft's pairs are saved together once they're valid; any other
 * field saves at once, with the stored pair values.
 */
function usePairDraft<T extends object>(rules: T, pairs: [keyof T, keyof T][], onSave: (r: T) => void) {
  const [draft, setDraft] = useState(rules);
  const pairKeys = pairs.flat();
  const pending = (from: T, onto: T) => ({ ...onto, ...Object.fromEntries(pairKeys.map((k) => [k, from[k]])) }) as T;
  // Adopt stored changes (a rollback, an import); keep a pending pair until it's fixed.
  useEffect(() => setDraft((d) => (pairsValid(d, pairs) ? rules : pending(d, rules))), [rules]); // eslint-disable-line react-hooks/exhaustive-deps
  function set(key: keyof T, v: T[keyof T]) {
    const next = { ...draft, [key]: v };
    setDraft(next);
    const toSave = pairsValid(next, pairs) ? next : pending(rules, next);
    if ((Object.keys(toSave) as (keyof T)[]).some((k) => toSave[k] !== rules[k])) onSave(toSave);
  }
  /** The message for pair i when the draft breaks it. */
  const errorAt = (i: number, message = "Low can't be above high") => (pairsValid(draft, [pairs[i]!]) ? null : message);
  return { draft, set, errorAt };
}

function ClassSection({ title, rules, onSave }: { title: string; rules: ClassRules; onSave: (r: ClassRules) => void }) {
  const { draft, set, errorAt } = usePairDraft(rules, PAIRS, onSave);
  const field = (key: keyof ClassRules, label: string, min: number, max: number) => (
    <NumberField label={label} value={draft[key]} min={min} max={max} integer onChange={(v) => set(key, v!)} />
  );
  const repError = errorAt(0);
  const aimError = errorAt(1, "Hardest can't be easier than easiest");
  return (
    <ListGroup title={title}>
      <ListItem>
        <div className={styles.pair}>
          {field("repLow", "Reps low", 1, 50)}
          {field("repHigh", "Reps high", 1, 50)}
        </div>
        {repError && <p role="alert" className={styles.error}>{repError}</p>}
        <div className={styles.pair}>
          <AimSelect label="Aim for (easiest)" rir={draft.rirHigh} onChange={(d) => set("rirHigh", rirFor(d))} />
          <AimSelect label="Aim for (hardest)" rir={draft.rirLow} onChange={(d) => set("rirLow", rirFor(d))} />
        </div>
        {aimError && <p role="alert" className={styles.error}>{aimError}</p>}
        <div className={styles.pair}>
          {field("sets", "Sets", 1, 20)}
          {field("warmupSets", "Warm-up sets", 0, 10)}
        </div>
        {field("restSeconds", "Rest (seconds)", 0, 900)}
      </ListItem>
    </ListGroup>
  );
}

/** One end of the effort aim, in difficulty words (stored as RIR). */
function AimSelect({ label, rir, onChange }: { label: string; rir: number; onChange: (d: Difficulty) => void }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={difficultyOf(rir)} onChange={(e) => onChange(e.target.value as Difficulty)}>
        {DIFFICULTIES.map((d) => (
          <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
        ))}
      </Select>
    </Field>
  );
}

type Volume = StyleRules["volume"];
const VOLUME_PAIRS: [keyof Volume, keyof Volume][] = [["low", "high"]];

function VolumeSection({ volume, onSave }: { volume: Volume; onSave: (v: Volume) => void }) {
  const { draft, set, errorAt } = usePairDraft(volume, VOLUME_PAIRS, onSave);
  const error = errorAt(0);
  return (
    <ListGroup title="Weekly volume" footer="Working sets per muscle each week (Sunday to Saturday).">
      <ListItem>
        <div className={styles.pair}>
          <NumberField label="Sets low" value={draft.low} min={0} max={60} integer onChange={(v) => set("low", v!)} />
          <NumberField label="Sets high" value={draft.high} min={0} max={60} integer onChange={(v) => set("high", v!)} />
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </ListItem>
    </ListGroup>
  );
}

export const styleRulesView = () => ({ id: "style-rules", title: "Style rules", render: () => <StyleRulesView /> });
