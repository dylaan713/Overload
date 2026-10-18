import { useEffect, useMemo, useState } from "react";
import { aimLabel } from "../../domain/difficulty";
import { blockFor, coachFor, logDayFor, prefill, sessionOn, setCount } from "../../domain/log";
import type { Block, SetEntry } from "../../domain/types";
import { useApp, useUi } from "../../state/context";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { EntryRow } from "./EntryRow";
import { SetList } from "./SetList";
import styles from "./Log.module.css";

const hasWorking = (b: Block | undefined) => !!b?.sets.some((s) => !s.warmup);
const pad = (n: number) => String(n).padStart(2, "0");
/** "2:14" from milliseconds. */
const minSec = (ms: number) => `${Math.floor(ms / 60_000)}:${pad(Math.floor(ms / 1000) % 60)}`;
/** "0:42" (hours:minutes) from milliseconds. */
const hourMin = (ms: number) => `${Math.floor(ms / 3_600_000)}:${pad(Math.floor(ms / 60_000) % 60)}`;
function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** One clock for the screen's counters, ticking each second. */
function useNow(now: () => number) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), 1000);
    return () => clearInterval(id);
  }, [now]);
  return t;
}

/** The Log tab: one exercise at a time, its fixed target beside last time, and the set being typed. */
export function LogScreen() {
  const doc = useApp((s) => s.doc);
  const today = useApp((s) => s.today)();
  const logSet = useApp((s) => s.logSet);
  const log = useUi((s) => s.log);
  const nowFn = useUi((s) => s.now);
  const setDraft = useUi((s) => s.setDraft);
  const markLogged = useUi((s) => s.markLogged);
  const openSheet = useUi((s) => s.openSheet);
  const now = useNow(nowFn);

  const day = logDayFor(doc, today, now, log.last);
  const session = sessionOn(doc, day);
  const draft = log.draft?.day === day ? log.draft : null;
  const exists = (id: string | null | undefined): id is string => !!id && doc.exercises.some((e) => e.id === id);
  const currentId = exists(draft?.exerciseId) ? draft!.exerciseId! : (session?.blocks.at(-1)?.exerciseId ?? null);
  const exercise = doc.exercises.find((e) => e.id === currentId);
  const block = currentId ? blockFor(doc, day, currentId) : undefined;
  const test = block?.test ?? (draft?.exerciseId === currentId ? (draft?.test ?? false) : false);

  // Fixed for the day: coachFor never sees the day's own sets, so logging doesn't move the targets.
  const coach = useMemo(() => (currentId ? coachFor(doc, currentId, day, test) : null), [doc, currentId, day, test]);

  const chips = session?.blocks.filter((b) => exists(b.exerciseId)) ?? [];
  const header = (
    <p className={styles.dayLine}>
      {dayLabel(day)}
      {session && log.startedAt != null && log.last?.day === day && ` · ${hourMin(now - log.startedAt)}`}
    </p>
  );

  if (!exercise || !coach) {
    return (
      <div className={styles.screen}>
        {header}
        <EmptyState text="Start with any exercise" />
        <Button variant="primary" block onClick={() => openSheet("next-exercise")}>＋ Next exercise</Button>
      </div>
    );
  }

  const { targets, last } = coach;
  const working = block?.sets.filter((s) => !s.warmup).length ?? 0;
  const m = setCount(targets);
  const next = targets.sets[Math.min(working, Math.max(0, targets.sets.length - 1))];
  const firstTime = targets.rule === "first-time";
  const warmupDefault = !hasWorking(block);
  const warmup = draft?.exerciseId === currentId ? draft.warmup : warmupDefault;

  function pick(exerciseId: string) {
    const b = blockFor(doc, day, exerciseId);
    setDraft({ day, exerciseId, weight: "", reps: "", difficulty: null, editing: null, warmup: !hasWorking(b), test: b?.test ?? false });
  }

  async function submit(set: SetEntry) {
    if (!(await logSet({ day, exerciseId: currentId!, set, test }))) return; // a failed save keeps what was typed
    markLogged(day, nowFn());
    setDraft({ day, exerciseId: currentId!, weight: "", reps: "", difficulty: null, editing: null, warmup: set.warmup, test });
  }

  return (
    <div className={styles.screen}>
      {header}
      {chips.length > 0 && (
        <div role="group" aria-label="Today's exercises" className={styles.chips}>
          {chips.map((b) => (
            <button key={b.id} type="button" className={styles.chip} aria-pressed={b.exerciseId === currentId} onClick={() => pick(b.exerciseId)}>
              {doc.exercises.find((e) => e.id === b.exerciseId)!.name}
            </button>
          ))}
        </div>
      )}

      <h2 className={styles.name}>{exercise.name}</h2>
      <p className={styles.meta}>
        {`Set ${working + 1} of ${m}`}
        {log.last?.day === day && ` · last set ${minSec(now - log.last.at)} ago`}
      </p>

      <div className={styles.compare}>
        <section aria-label="Target" className={styles.box}>
          <span className={styles.boxLabel}>Target</span>
          {firstTime ? (
            <span className={styles.boxNote}>{`First time: pick a weight you could do for ${targets.sets[0]?.reps ?? 0} reps`}</span>
          ) : (
            <>
              <b className={styles.boxValue}>{targets.ladder?.length ? `Work up: ${targets.ladder.join(" · ")}` : `${targets.weight ?? "—"} × ${next?.reps ?? "—"}`}</b>
              {next && <span className={styles.boxNote}>{aimLabel(next.rirLow, next.rirHigh)}</span>}
            </>
          )}
        </section>
        <section aria-label="Last time" className={styles.box}>
          <span className={styles.boxLabel}>Last time</span>
          {last ? (
            <>
              <b className={styles.boxValue}>{`${last.W} × ${last.best}`}</b>
              <span className={styles.boxNote}>{last.sets.map((s) => s.reps).join(" · ")}</span>
            </>
          ) : (
            <span className={styles.boxNote}>—</span>
          )}
        </section>
      </div>
      {!firstTime && <p className={styles.reason}>{targets.reason}</p>}
      {working === 0 && targets.warmups.length > 0 && (
        <p className={styles.hint}>{`Warm-up: ${targets.warmups.map((w) => `${w.weight}×${w.reps}`).join(" · ")}`}</p>
      )}

      <EntryRow
        key={currentId}
        day={day}
        exerciseId={currentId!}
        warmupDefault={warmupDefault}
        unit={doc.settings.unit}
        placeholder={prefill(targets, block, warmup)}
        mode="new"
        onSubmit={(set) => void submit(set)}
      />
      <SetList block={block} />

      <div className={styles.dock}>
        <Button variant="secondary" block onClick={() => openSheet("next-exercise")}>＋ Next exercise</Button>
      </div>
    </div>
  );
}
