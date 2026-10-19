import { plural } from "../../app/format";
import { repeatQueue } from "../../domain/historyDays";
import { logDayFor } from "../../domain/log";
import type { AppStore } from "../../state/appStore";
import type { UiStore } from "../../state/uiStore";
import { freshDraft } from "../log/draft";

/**
 * Lines a past workout up on today's Log: the first exercise goes on the entry row (unless something is typed
 * there), the rest wait in "Up next". Nothing logged or typed is replaced.
 */
export function repeatWorkout(app: AppStore, ui: UiStore, date: string): void {
  const { doc, today } = app.getState();
  const s = ui.getState();
  const day = logDayFor(doc, today(), s.now(), s.log.last);
  const { ids, skipped } = repeatQueue(doc, date, day);
  if (ids.length === 0) {
    s.showToast({ text: "Nothing to repeat" });
    return;
  }
  const d = s.log.draft;
  const free = !d || d.day !== day || !d.exerciseId || (d.weight === null && d.reps === null);
  if (free) {
    s.setDraft(freshDraft(doc, day, ids[0]!));
    s.setQueue(day, ids.slice(1));
  } else {
    s.setQueue(day, ids);
  }
  s.closeSheet();
  s.setTab("log");
  if (skipped > 0) s.showToast({ text: `Skipped ${plural(skipped, "archived exercise")}` });
}
