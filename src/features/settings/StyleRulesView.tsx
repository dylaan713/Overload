import { useState } from "react";
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

function ClassSection({ title, rules, onSave }: { title: string; rules: ClassRules; onSave: (r: ClassRules) => void }) {
  const [pairError, setPairError] = useState<string | null>(null);
  function set(key: keyof ClassRules, v: number) {
    const next = { ...rules, [key]: v };
    if (PAIRS.some(([lo, hi]) => next[lo] > next[hi])) {
      setPairError("Low can't be above high");
      return;
    }
    setPairError(null);
    onSave(next);
  }
  const field = (key: keyof ClassRules, label: string, min: number, max: number) => (
    <NumberField label={label} value={rules[key]} min={min} max={max} integer onChange={(v) => set(key, v!)} />
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
        {pairError && <p role="alert" className={styles.error}>{pairError}</p>}
        <div className={styles.pair}>
          {field("sets", "Sets", 1, 20)}
          {field("warmupSets", "Warm-up sets", 0, 10)}
        </div>
        {field("restSeconds", "Rest (seconds)", 0, 900)}
      </ListItem>
    </ListGroup>
  );
}

function VolumeSection({ volume, onSave }: { volume: StyleRules["volume"]; onSave: (v: StyleRules["volume"]) => void }) {
  const [error, setError] = useState<string | null>(null);
  function set(key: "low" | "high", v: number) {
    const next = { ...volume, [key]: v };
    if (next.low > next.high) return setError("Low can't be above high");
    setError(null);
    onSave(next);
  }
  return (
    <ListGroup title="Weekly volume" footer="Working sets per muscle each week (Sunday to Saturday).">
      <ListItem>
        <div className={styles.pair}>
          <NumberField label="Sets low" value={volume.low} min={0} max={60} integer onChange={(v) => set("low", v!)} />
          <NumberField label="Sets high" value={volume.high} min={0} max={60} integer onChange={(v) => set("high", v!)} />
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </ListItem>
    </ListGroup>
  );
}

export const styleRulesView = () => ({ id: "style-rules", title: "Style rules", render: () => <StyleRulesView /> });
