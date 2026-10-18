import { blockFor, logDayFor } from "../../domain/log";
import type { StoreDoc } from "../../domain/types";
import { useApp, useUi } from "../../state/context";
import type { LogDraft } from "../../state/uiStore";

/** A clean entry row for an exercise: warm-up on until it has a working set today. */
export function freshDraft(doc: StoreDoc, day: string, exerciseId: string): LogDraft {
  const b = blockFor(doc, day, exerciseId);
  return { day, exerciseId, weight: "", reps: "", difficulty: null, editing: null, warmup: !b?.sets.some((s) => !s.warmup), test: b?.test ?? false };
}

/** The day the Log is on right now (today, or a workout still going past midnight). */
export function useLogDay(): string {
  const doc = useApp((s) => s.doc);
  const today = useApp((s) => s.today)();
  const last = useUi((s) => s.log.last);
  const now = useUi((s) => s.now)();
  return logDayFor(doc, today, now, last);
}
