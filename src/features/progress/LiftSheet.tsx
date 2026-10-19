import { useMemo, useState } from "react";
import { addDays } from "../../domain/dates";
import { attentionFor, liftSeries, metricOf, sessionE1rm } from "../../domain/progress";
import type { SetEntry, StoreDoc } from "../../domain/types";
import { useApp } from "../../state/context";
import { EmptyState } from "../../ui/EmptyState";
import { ListGroup, ListItem, ListRow } from "../../ui/ListRow";
import { Segmented } from "../../ui/Segmented";
import { SheetStack, type SheetView } from "../../ui/SheetStack";
import { LiftChart } from "./LiftChart";
import styles from "./Progress.module.css";

type Range = "4wk" | "3mo" | "1yr";
const DAYS: Record<Range, number> = { "4wk": 28, "3mo": 91, "1yr": 365 };

const setText = (s: SetEntry) => (s.weight > 0 ? `${s.weight} × ${s.reps}` : `${s.reps} reps`);

/** Every working set of a lift up to today, oldest first, with its date. */
function workingSets(doc: StoreDoc, exerciseId: string, today: string): { date: string; set: SetEntry }[] {
  return doc.sessions
    .filter((s) => s.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => s.blocks.filter((b) => b.exerciseId === exerciseId).flatMap((b) => b.sets.filter((x) => !x.warmup).map((set) => ({ date: s.date, set }))));
}

function LiftView({ exerciseId }: { exerciseId: string }) {
  const doc = useApp((s) => s.doc);
  const today = useApp((s) => s.today)();
  const [range, setRange] = useState<Range>("3mo");
  const ex = doc.exercises.find((e) => e.id === exerciseId);
  const points = useMemo(() => liftSeries(doc, exerciseId, addDays(today, -(DAYS[range] - 1)), today), [doc, exerciseId, today, range]);
  const all = useMemo(() => workingSets(doc, exerciseId, today), [doc, exerciseId, today]);
  const stuck = useMemo(() => attentionFor(doc, today, exerciseId), [doc, today, exerciseId]);
  if (!ex) return <EmptyState text="This exercise is gone." />;

  const metric = metricOf(ex, all.map((x) => x.set));
  const score = (s: SetEntry) => (metric === "reps" ? s.reps : sessionE1rm([s]));
  const best = all.reduce<SetEntry | null>((b, { set }) => (!b || score(set) > score(b) ? set : b), null);
  const lastDate = all.at(-1)?.date;
  const lastSets = all.filter((x) => x.date === lastDate).map((x) => x.set);
  const top = lastSets.reduce<SetEntry | null>((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), null);

  return (
    <>
      {stuck && (
        <ListGroup title="Why it's stuck">
          <ListItem><p className={styles.why}>{stuck.reason}</p></ListItem>
        </ListGroup>
      )}
      <ListGroup title={metric === "reps" ? "Reps" : "Est. 1RM"}>
        <ListItem>
          <Segmented<Range>
            label="Range"
            value={range}
            options={[{ value: "4wk", label: "4 wk" }, { value: "3mo", label: "3 mo" }, { value: "1yr", label: "1 yr" }]}
            onChange={setRange}
          />
          {points.length === 0 ? <EmptyState text="Not enough data yet" /> : <LiftChart points={points} unit={doc.settings.unit} metric={metric} />}
        </ListItem>
      </ListGroup>
      {best && top && (
        <ListGroup title="Sets">
          <ListRow label="Best set"><span className={styles.detail}>{setText(best)}</span></ListRow>
          <ListRow label="Last time"><span className={styles.detail}>{setText(top)}</span></ListRow>
        </ListGroup>
      )}
    </>
  );
}

const liftView = (exerciseId: string, title: string): SheetView => ({
  id: `lift-${exerciseId}`,
  title,
  render: () => <LiftView exerciseId={exerciseId} />,
});

/** A lift's chart, best set and last time, opened from Progress. */
export function LiftSheet({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const name = useApp((s) => s.doc.exercises.find((e) => e.id === exerciseId)?.name ?? "Lift");
  const [root] = useState(() => liftView(exerciseId, name));
  return <SheetStack root={root} onClose={onClose} />;
}
