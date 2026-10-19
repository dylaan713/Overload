import { useMemo, useState } from "react";
import { daySummary, latestTrainingDay, trainingDays } from "../../domain/historyDays";
import { plural } from "../../app/format";
import { useApp, useUi } from "../../state/context";
import { EmptyState } from "../../ui/EmptyState";
import { ListGroup, ListItem, ListRow } from "../../ui/ListRow";
import { Calendar } from "./Calendar";

const longDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(y!, m! - 1 + delta, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/** Find a past workout by roughly when it was: a month calendar and the selected day's summary. */
export function HistoryScreen() {
  const doc = useApp((s) => s.doc);
  const today = useApp((s) => s.today)();
  const openSheet = useUi((s) => s.openSheet);
  const days = useMemo(() => trainingDays(doc), [doc]);
  const [selected, setSelected] = useState(() => latestTrainingDay(doc, today));
  // The month of the selected workout, so the grid and the summary below it agree (e.g. on the 1st).
  const [month, setMonth] = useState(() => (selected ?? today).slice(0, 7));
  const summary = selected ? daySummary(doc, selected) : null;

  return (
    <>
      <ListGroup title="Calendar">
        <ListItem>
          <Calendar month={month} days={days} today={today} selected={selected} onSelect={setSelected} onMonth={(d) => setMonth((m) => shiftMonth(m, d))} />
        </ListItem>
      </ListGroup>
      {days.size === 0 ? (
        <EmptyState text="No workouts logged yet" />
      ) : summary ? (
        <ListGroup title="Workout">
          <ListRow
            label={longDate(summary.date)}
            subtitle={`${summary.muscles.join(", ")} · ${plural(summary.exerciseCount, "exercise")}`}
            onPress={() => openSheet("workout", { arg: summary.date })}
          />
        </ListGroup>
      ) : null}
    </>
  );
}

