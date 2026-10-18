import { useEffect, useState } from "react";
import { capitalize } from "../../app/format";
import { phaseOf } from "../../domain/settings";
import type { ClassRules, Style, StyleRules } from "../../domain/types";
import { useApp } from "../../state/context";
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
  const valid = pairsValid(draft, pairs);
  function set(key: keyof T, v: T[keyof T]) {
    const next = { ...draft, [key]: v };
    setDraft(next);
    const toSave = pairsValid(next, pairs) ? next : pending(rules, next);
    if ((Object.keys(toSave) as (keyof T)[]).some((k) => toSave[k] !== rules[k])) onSave(toSave);
  }
  return { draft, set, error: valid ? null : "Low can't be above high" };
}

function ClassSection({ title, rules, onSave }: { title: string; rules: ClassRules; onSave: (r: ClassRules) => void }) {
  const { draft, set, error } = usePairDraft(rules, PAIRS, onSave);
  const field = (key: keyof ClassRules, label: string, min: number, max: number) => (
    <NumberField label={label} value={draft[key]} min={min} max={max} integer onChange={(v) => set(key, v!)} />
  );
  return (
    <ListGroup title={title}>
      <ListItem>
        <div className={styles.pair}>
          {field("repLow", "Reps low", 1, 50)}
          {field("repHigh", "Reps high", 1, 50)}
        </div>
        <div className={styles.pair}>
          {field("rirLow", "Target RIR low", 0, 4)}
          {field("rirHigh", "Target RIR high", 0, 4)}
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.pair}>
          {field("sets", "Sets", 1, 20)}
          {field("warmupSets", "Warm-up sets", 0, 10)}
        </div>
        {field("restSeconds", "Rest (seconds)", 0, 900)}
      </ListItem>
    </ListGroup>
  );
}

type Volume = StyleRules["volume"];
const VOLUME_PAIRS: [keyof Volume, keyof Volume][] = [["low", "high"]];

function VolumeSection({ volume, onSave }: { volume: Volume; onSave: (v: Volume) => void }) {
  const { draft, set, error } = usePairDraft(volume, VOLUME_PAIRS, onSave);
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
