import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { MUSCLE_LABEL } from "../../domain/library/muscles";
import { strengthMap, weekLine, weekMap, type StrengthCell, type WeekCell } from "../../domain/muscleMap";
import { progressSummary, type LiftProgress } from "../../domain/progress";
import { MUSCLES, type Muscle, type Unit } from "../../domain/types";
import { useApp, useUi } from "../../state/context";
import { EmptyState } from "../../ui/EmptyState";
import { ListGroup, ListItem, ListRow } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { changeText } from "./format";
import { MuscleFigure, type Tone } from "./MuscleFigure";
import { Sparkline } from "./Sparkline";
import styles from "./Progress.module.css";

type Section = "lifts" | "muscles";
type View = "week" | "strength";

const WEEK_TONE: Record<WeekCell["state"], Tone> = { none: "none", "under-half": "l1", almost: "l2", in: "l3", over: "over" };
const STRENGTH_TONE: Record<StrengthCell["state"], Tone> = { "no-data": "none", down: "down", flat: "flat", up: "l2", "up-a-lot": "l3" };
const LEGEND: Record<View, [Tone, string][]> = {
  week: [["none", "None"], ["l1", "Under half"], ["l2", "Almost"], ["l3", "In range"], ["over", "Over"]],
  strength: [["down", "Down"], ["flat", "Flat"], ["l2", "Up"], ["l3", "Up a lot"], ["none", "No data"]],
};
const STRENGTH_WORD: Record<StrengthCell["state"], string> = { "no-data": "no data", down: "down", flat: "flat", up: "up", "up-a-lot": "up a lot" };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

/** Am I getting stronger, and what's short: the muscle map, the 8-week headline, what needs attention, every lift. */
export function ProgressScreen() {
  const doc = useApp((s) => s.doc);
  const today = useApp((s) => s.today)();
  const openSheet = useUi((s) => s.openSheet);
  const [section, setSection] = useState<Section>("lifts");
  const [view, setView] = useState<View>("week");
  const [muscle, setMuscle] = useState<Muscle | null>(null);

  const summary = useMemo(() => progressSummary(doc, today), [doc, today]);
  const week = useMemo(() => weekMap(doc, today), [doc, today]);
  const strength = useMemo(() => strengthMap(doc, today), [doc, today]);
  const unit = doc.settings.unit;
  const openLift = (id: string) => openSheet("lift", { arg: id });

  const tones = Object.fromEntries(MUSCLES.map((m) => [m, view === "week" ? WEEK_TONE[week[m].state] : STRENGTH_TONE[strength[m].state]])) as Record<Muscle, Tone>;
  const labels = Object.fromEntries(MUSCLES.map((m) => [
    m,
    view === "week"
      ? `${MUSCLE_LABEL[m]}, ${week[m].sets} of ${week[m].low} to ${week[m].high} sets`
      : `${MUSCLE_LABEL[m]}, ${STRENGTH_WORD[strength[m].state]}`,
  ])) as Record<Muscle, string>;

  return (
    <div className={styles.screen}>
      <div className={styles.sections}>
        <Segmented<Section>
          label="Progress view"
          value={section}
          options={[{ value: "lifts", label: "Lifts" }, { value: "muscles", label: "Muscles" }]}
          onChange={setSection}
        />
      </div>

      {section === "muscles" ? (
        <ListGroup title={view === "week" ? "Sets this week" : "Strength, last 8 weeks"}>
          <ListItem>
            <Segmented<View>
              label="Muscle map"
              value={view}
              options={[{ value: "week", label: "Sets" }, { value: "strength", label: "Strength" }]}
              onChange={setView}
            />
            <MuscleFigure tones={tones} labels={labels} selected={muscle} onSelect={setMuscle} />
            <ul className={styles.legend} aria-label="Legend">
              {LEGEND[view].map(([tone, word]) => (
                <li key={word}><span className={styles.swatch} style={{ background: `var(--map-${tone})` }} aria-hidden="true" />{word}</li>
              ))}
            </ul>
          </ListItem>
          {muscle && <MusclePanel muscle={muscle} view={view} week={week[muscle]} strength={strength[muscle]} unit={unit} onLift={openLift} />}
        </ListGroup>
      ) : summary.counted === 0 ? (
        <EmptyState text="Log a few sessions to see progress here" />
      ) : (
        <>
          <ListGroup title="Last 8 weeks">
            <ListItem>
              <p className={styles.headline}>Stronger on {summary.stronger} of {summary.counted} lifts</p>
              {summary.avgPct !== null && <p className={styles.subline}>Average est. 1RM {signed(summary.avgPct)}%</p>}
            </ListItem>
          </ListGroup>
          {summary.attention.length > 0 && (
            <ListGroup title="Needs attention">
              {summary.attention.map((a) => <ListRow key={a.exerciseId} label={a.name} subtitle={a.short} onPress={() => openLift(a.exerciseId)} />)}
            </ListGroup>
          )}
        </>
      )}

      {section === "lifts" && summary.lifts.length > 0 && (
        <ListGroup title="Your lifts">
          {summary.lifts.map((l) => <LiftRow key={l.exerciseId} lift={l} unit={unit} onPress={() => openLift(l.exerciseId)} />)}
        </ListGroup>
      )}
    </div>
  );
}

function LiftRow({ lift, unit, onPress }: { lift: LiftProgress; unit: Unit; onPress: () => void }) {
  const text = changeText(lift, unit);
  const tone = lift.trend === "down" ? "down" : lift.trend === "up" || lift.trend === "up-a-lot" ? "up" : "flat";
  return (
    <ListRow
      label={lift.name}
      onPress={onPress}
      trailing={
        <span className={styles.trailing}>
          <Sparkline points={lift.points} trend={lift.trend} />
          <span className={styles.change} data-tone={lift.trend === null ? undefined : tone}>{text}</span>
          <ChevronRight aria-hidden="true" size={18} className={styles.chevron} />
        </span>
      }
    />
  );
}

function MusclePanel({ muscle, view, week, strength, unit, onLift }: {
  muscle: Muscle; view: View; week: WeekCell; strength: StrengthCell; unit: Unit; onLift: (id: string) => void;
}) {
  const name = MUSCLE_LABEL[muscle];
  if (view === "week") {
    return <ListItem><p className={styles.panelLine} aria-live="polite">{weekLine(muscle, week)}</p></ListItem>;
  }
  return (
    <section aria-label={name} aria-live="polite" className={styles.panel}>
      {strength.lifts.length === 0 ? (
        <ListItem><p className={styles.panelLine}>{name} · no lift with enough sessions yet</p></ListItem>
      ) : (
        strength.lifts.map((l) => <ListRow key={l.exerciseId} label={l.name} detail={changeText(l, unit)} onPress={() => onLift(l.exerciseId)} />)
      )}
    </section>
  );
}
