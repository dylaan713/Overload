import { useEffect, useMemo, useRef, useState } from "react";
import { aimLabel, difficultyOf } from "../../domain/difficulty";
import { fatigueSuggestion } from "../../domain/engine/fatigue";
import { blockFor, canTest, coachFor, logDayFor, prefill, sessionOn, setCount, withoutDay } from "../../domain/log";
import type { Block, SetEntry } from "../../domain/types";
import { useApp, useAppStore, useUi, useUiStore } from "../../state/context";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { freshDraft } from "./draft";
import { EntryRow } from "./EntryRow";
import { FatigueCard } from "./FatigueCard";
import { TestDayMenu } from "./TestDayMenu";
import { SetList, setLabels } from "./SetList";
import styles from "./Log.module.css";

const DOUBLE_TAP_MS = 500;
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
  const appStore = useAppStore();
  const ui = useUiStore();
  const startEdit = useUi((s) => s.startEdit);
  const endEdit = useUi((s) => s.endEdit);
  const logSet = useApp((s) => s.logSet);
  const editSet = useApp((s) => s.editSet);
  const removeSet = useApp((s) => s.removeSet);
  const restoreSet = useApp((s) => s.restoreSet);
  const showToast = useUi((s) => s.showToast);
  const setBlockTest = useApp((s) => s.setBlockTest);
  const decideFatigue = useApp((s) => s.decideFatigue);
  const log = useUi((s) => s.log);
  const nowFn = useUi((s) => s.now);
  const setDraft = useUi((s) => s.setDraft);
  const markLogged = useUi((s) => s.markLogged);
  const openSheet = useUi((s) => s.openSheet);
  const now = useNow(nowFn);
  const saving = useRef(false);
  const loggedAt = useRef(-Infinity);

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

  // Judged on finished days only: a half-done workout today can't make this pop up mid-session.
  const fatigue = useMemo(() => fatigueSuggestion(withoutDay(doc, day), day), [doc, day]);
  const fatigueCard = fatigue && (
    <FatigueCard
      reason={fatigue.reason}
      onAccept={() => void decideFatigue(fatigue.weekStart, "accepted")}
      onDismiss={() => void decideFatigue(fatigue.weekStart, "dismissed")}
    />
  );

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
        {fatigueCard}
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
  const warmup = draft?.exerciseId === currentId ? draft.warmup : false;
  const editing = draft?.exerciseId === currentId && draft.editing && block && draft.editing.blockId === block.id ? draft.editing : null;
  const editedSet = editing ? block?.sets[editing.index] : undefined;
  const labels = setLabels(block);
  // Leaving an edit brings back what was being typed for the next set.
  const backToNew = () => endEdit();

  // Re-picking the exercise already in hand keeps what's typed.
  const pick = (exerciseId: string) => {
    if (exerciseId !== currentId || draft?.exerciseId !== exerciseId) setDraft(freshDraft(doc, day, exerciseId));
  };

  async function submit(set: SetEntry) {
    // A double tap logs one set: ignore taps while saving and just after (nobody logs sets 0.5 s apart).
    if (saving.current || performance.now() - loggedAt.current < DOUBLE_TAP_MS) return;
    saving.current = true;
    try {
      if (editing) {
        if (await editSet(editing, set)) backToNew();
        return;
      }
      if (!(await logSet({ day, exerciseId: currentId!, set, test }))) return; // a failed save keeps what was typed
      loggedAt.current = performance.now();
      markLogged(day, nowFn());
      setDraft({ day, exerciseId: currentId!, weight: "", reps: "", difficulty: null, editing: null, warmup: set.warmup, test });
    } finally {
      saving.current = false;
    }
  }

  async function toggleTest(on: boolean) {
    if (block && (await setBlockTest(day, currentId!, on))) return; // refused or not saved: leave it as it was
    setDraft(draft?.exerciseId === currentId ? { day, test: on } : { ...freshDraft(doc, day, currentId!), test: on });
  }

  function edit(index: number) {
    const set = block!.sets[index]!;
    if (draft?.exerciseId !== currentId) setDraft(freshDraft(doc, day, currentId!));
    startEdit(day, { day, blockId: block!.id, index }, {
      weight: String(set.weight), reps: String(set.reps), warmup: set.warmup, difficulty: set.rir == null ? null : difficultyOf(set.rir),
    });
  }

  // By the set itself: its position may have moved since the swipe began.
  async function remove(set: SetEntry): Promise<boolean> {
    const current = blockFor(appStore.getState().doc, day, currentId!);
    const index = current ? current.sets.indexOf(set) : -1;
    if (!current || index < 0) return false;
    const label = setLabels(current)[index]!;
    const removed = await removeSet({ day, blockId: current.id, index });
    if (!removed) return false;
    // Positions shift on remove and on Undo, so an edit in progress ends either way rather than land on another set.
    const endEditIn = () => {
      const d = ui.getState().log.draft;
      if (d?.editing?.blockId === removed.block.id) ui.getState().endEdit();
    };
    endEditIn();
    showToast({
      text: label === "W" ? "Removed warm-up" : `Removed set ${label}`,
      action: {
        label: "Undo",
        onAction: () => {
          endEditIn();
          void restoreSet(removed);
        },
      },
    });
    return true;
  }

  return (
    <div className={styles.screen}>
      {header}
      {fatigueCard}
      {chips.length > 0 && (
        <div role="group" aria-label="Today's exercises" className={styles.chips}>
          {chips.map((b) => (
            <button key={b.id} type="button" className={styles.chip} aria-pressed={b.exerciseId === currentId} onClick={() => pick(b.exerciseId)}>
              {doc.exercises.find((e) => e.id === b.exerciseId)!.name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.titleRow}>
        <h2 className={styles.name}>{exercise.name}</h2>
        {canTest(exercise) && <TestDayMenu on={test} locked={hasWorking(block)} onChange={(on) => void toggleTest(on)} />}
      </div>
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

      {editing && <p className={styles.editing}>{labels[editing.index] === "W" ? "Editing warm-up" : `Editing set ${labels[editing.index]}`}</p>}
      <EntryRow
        key={`${currentId}:${editing ? editing.index : "new"}`}
        day={day}
        exerciseId={currentId!}
        unit={doc.settings.unit}
        placeholder={editedSet ? { weight: editedSet.weight, reps: editedSet.reps } : prefill(targets, block, warmup)}
        mode={editing ? "edit" : "new"}
        onSubmit={(set) => void submit(set)}
        onCancel={backToNew}
        onDelete={() => editedSet && void remove(editedSet)}
      />
      <SetList block={block} editingIndex={editing?.index ?? null} onEdit={edit} onRemove={remove} />

      <div className={styles.dock}>
        <Button variant="secondary" block onClick={() => openSheet("next-exercise")}>＋ Next exercise</Button>
      </div>
    </div>
  );
}
