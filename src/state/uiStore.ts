import { createStore, type StoreApi } from "zustand/vanilla";
import type { KeyValueStore } from "../data/kv";
import { DIFFICULTIES, type Difficulty } from "../domain/difficulty";
import type { SetRef } from "../domain/log";

export const UI_KEY = "overload.v2.ui";
export type Tab = "log" | "progress" | "history";
export type SheetId = "settings" | "next-exercise";
export interface Toast {
  id: string;
  text: string;
  action?: { label: string; onAction(): void };
}

/** What's on the Log's entry row, kept on every keystroke so nothing typed is lost. */
export interface LogDraft {
  day: string;
  exerciseId: string | null;
  /** What's typed; null = untouched, so the field shows (and logs) the target. "" = cleared on purpose. */
  weight: string | null;
  reps: string | null;
  difficulty: Difficulty | null;
  warmup: boolean;
  editing: SetRef | null;
  /** The next set's half-typed fields, kept aside while an earlier set is being fixed. */
  pending: Pick<LogDraft, "weight" | "reps" | "difficulty" | "warmup"> | null;
  test: boolean;
}

export interface LogUi {
  draft: LogDraft | null;
  startedAt: number | null; // first set of the Log's day, for the workout clock
  last: { day: string; at: number } | null; // the latest logged set
  /** Exercises left from a repeated workout, in order; only meaningful on its day. */
  queue: { day: string; ids: string[] } | null;
}

export interface UiState {
  tab: Tab;
  sheet: SheetId | null;
  /** The sheet opens with its search focused (the Log has nothing on it yet). */
  sheetSearch: boolean;
  toast: Toast | null;
  log: LogUi;
  /** Where focus goes once the sheet has closed: what opened it, or the Log's entry row after a pick. */
  focusAfterSheet: HTMLElement | "entry" | null;
  now(): number;
  setTab(tab: Tab): void;
  openSheet(sheet: SheetId, opts?: { search?: boolean }): void;
  closeSheet(): void;
  /** Sends focus to the Log's weight field when the open sheet closes (e.g. after picking an exercise). */
  focusEntryAfterSheet(): void;
  showToast(toast: Omit<Toast, "id">): void;
  dismissToast(): void;
  setDraft(patch: Partial<LogDraft> & { day: string }): void;
  /** Back to an empty entry row, keeping the exercise, warm-up and test choices. */
  clearDraftFields(): void;
  /** Starts fixing a set, keeping the next set's half-typed fields aside. */
  startEdit(day: string, editing: SetRef, fields: Pick<LogDraft, "weight" | "reps" | "difficulty" | "warmup">): void;
  /** Stops fixing a set and brings back what was being typed for the next one. */
  endEdit(): void;
  markLogged(day: string, at: number): void;
  /** Lines up a past workout's exercises for the Log's day. */
  setQueue(day: string, ids: string[]): void;
  /** Drops an exercise from the queue (after it's picked). */
  unqueue(exerciseId: string): void;
  /** Writes any pending change now. */
  flush(): Promise<void>;
  hydrate(): Promise<void>;
}

export type UiStore = StoreApi<UiState>;

const TABS: readonly Tab[] = ["log", "progress", "history"];
const TOAST_MS = 6000;
export const DRAFT_DEBOUNCE_MS = 250;
const EMPTY_LOG: LogUi = { draft: null, startedAt: null, last: null, queue: null };

const newDraft = (day: string): LogDraft => ({ day, exerciseId: null, weight: null, reps: null, difficulty: null, warmup: false, editing: null, pending: null, test: false });

/** Transient UI state: never in backups, and its storage errors never block the app. */
export function createUiStore(kv: KeyValueStore, opts: { now?: () => number } = {}): UiStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let toastSeq = 0;
  // Nothing is written until the stored state has been read, so an early change can't overwrite it;
  // what the user changed before then wins over what was stored.
  let hydrated = false;
  const touched = { tab: false, draft: false };
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return createStore<UiState>()((set, get) => {
    const write = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      if (!hydrated) return Promise.resolve();
      const { tab, log } = get();
      return kv.set(UI_KEY, JSON.stringify({ version: 4, tab, log })).catch(() => {});
    };
    const schedule = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void write(), DRAFT_DEBOUNCE_MS);
    };
    const setLog = (log: LogUi) => {
      set({ log });
      schedule();
    };

    return {
      tab: "log",
      sheet: null,
      sheetSearch: false,
      toast: null,
      log: EMPTY_LOG,
      focusAfterSheet: null,
      now: opts.now ?? (() => Date.now()),

      setTab(tab) {
        touched.tab = true;
        set({ tab });
        void write();
      },
      openSheet: (sheet, opts = {}) => set({ sheet, sheetSearch: opts.search ?? false, focusAfterSheet: typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null }),
      closeSheet: () => set({ sheet: null }),
      focusEntryAfterSheet: () => set({ focusAfterSheet: "entry" }),

      showToast(toast) {
        clear();
        set({ toast: { ...toast, id: `toast-${++toastSeq}` } });
        timer = setTimeout(() => set({ toast: null }), TOAST_MS);
      },
      dismissToast() {
        clear();
        set({ toast: null });
      },

      setDraft(patch) {
        touched.draft = true;
        const { log } = get();
        const base = log.draft && log.draft.day === patch.day ? log.draft : newDraft(patch.day);
        setLog({ ...log, draft: { ...base, ...patch } });
      },
      clearDraftFields() {
        const { log } = get();
        touched.draft = true;
        if (log.draft) setLog({ ...log, draft: { ...log.draft, weight: null, reps: null, difficulty: null, editing: null, pending: null } });
      },
      startEdit(day, editing, fields) {
        touched.draft = true;
        const { log } = get();
        const base = log.draft && log.draft.day === day ? log.draft : newDraft(day);
        // Switching from one set being fixed to another keeps the original half-typed next set.
        const pending = base.editing ? base.pending : { weight: base.weight, reps: base.reps, difficulty: base.difficulty, warmup: base.warmup };
        setLog({ ...log, draft: { ...base, ...fields, editing, pending } });
      },
      endEdit() {
        const { log } = get();
        const d = log.draft;
        if (!d?.editing) return;
        touched.draft = true;
        const back = d.pending ?? { weight: null, reps: null, difficulty: null, warmup: false };
        setLog({ ...log, draft: { ...d, ...back, editing: null, pending: null } });
      },
      markLogged(day, at) {
        const { log } = get();
        setLog({ ...log, startedAt: log.last?.day === day && log.startedAt != null ? log.startedAt : at, last: { day, at } });
      },
      setQueue(day, ids) {
        setLog({ ...get().log, queue: ids.length ? { day, ids } : null });
      },
      unqueue(exerciseId) {
        const { log } = get();
        if (!log.queue) return;
        const ids = log.queue.ids.filter((id) => id !== exerciseId);
        setLog({ ...log, queue: ids.length ? { ...log.queue, ids } : null });
      },
      flush: () => write(),

      async hydrate() {
        if (hydrated) return;
        try {
          const raw = await kv.get(UI_KEY);
          const saved = raw ? (JSON.parse(raw) as { version?: number; tab?: unknown; log?: unknown }) : null;
          if (!touched.tab && typeof saved?.version === "number" && saved.version >= 1 && saved.version <= 4 && TABS.includes(saved.tab as Tab)) set({ tab: saved.tab as Tab });
          if (saved?.version === 2 || saved?.version === 3 || saved?.version === 4) {
            const stored = readLog(saved.log, saved.version);
            const mine = get().log;
            const newer = (mine.last?.at ?? -Infinity) > (stored.last?.at ?? -Infinity) ? mine : stored;
            set({ log: { draft: touched.draft ? mine.draft : stored.draft, startedAt: newer.startedAt, last: newer.last, queue: mine.queue ?? stored.queue } });
          }
        } catch {
          // Transient state only: start on the defaults.
        } finally {
          hydrated = true;
          if (touched.tab || touched.draft || get().log.last) void write();
        }
      },
    };
  });
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown) => typeof v === "string";
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const field = (v: unknown) => v === null || str(v);
/** Version 2 had no "cleared" state: an empty field logged the target, which untouched (null) does now. */
const upgrade = <T extends { weight: string | null; reps: string | null }>(f: T): T => ({ ...f, weight: f.weight || null, reps: f.reps || null });

function readDraft(v: unknown, version: number): LogDraft | null {
  if (!isObj(v) || !str(v.day) || !field(v.weight) || !field(v.reps) || typeof v.warmup !== "boolean" || typeof v.test !== "boolean") return null;
  if (v.exerciseId !== null && !str(v.exerciseId)) return null;
  if (v.difficulty !== null && !DIFFICULTIES.includes(v.difficulty as Difficulty)) return null;
  const e = v.editing;
  if (e !== null && !(isObj(e) && str(e.day) && str(e.blockId) && num(e.index))) return null;
  const p = v.pending;
  const pendingOk = isObj(p) && field(p.weight) && field(p.reps) && typeof p.warmup === "boolean" && (p.difficulty === null || DIFFICULTIES.includes(p.difficulty as Difficulty));
  const draft = { ...(v as unknown as LogDraft), pending: pendingOk ? (p as unknown as NonNullable<LogDraft["pending"]>) : null };
  if (version >= 3) return draft;
  return { ...upgrade(draft), pending: draft.pending && upgrade(draft.pending) };
}

/** A queue is kept only if well-formed and, when there's a draft, from the draft's day. */
function readQueue(v: unknown, draft: LogDraft | null): LogUi["queue"] {
  if (!isObj(v) || !str(v.day) || !Array.isArray(v.ids) || !v.ids.every(str) || v.ids.length === 0) return null;
  if (draft && draft.day !== v.day) return null;
  return { day: v.day as string, ids: v.ids as string[] };
}

/** Stored UI state is untrusted: any malformed field falls back to empty instead of crashing the Log. */
function readLog(v: unknown, version: number): LogUi {
  if (!isObj(v)) return EMPTY_LOG;
  const last = isObj(v.last) && str(v.last.day) && num(v.last.at) ? { day: v.last.day as string, at: v.last.at as number } : null;
  const draft = readDraft(v.draft, version);
  return { draft, startedAt: num(v.startedAt) ? (v.startedAt as number) : null, last, queue: version >= 4 ? readQueue(v.queue, draft) : null };
}

/** Writes pending UI state the moment the page is hidden or unloaded (iOS may kill it right after). */
export function watchHidden(ui: UiStore): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void ui.getState().flush();
  };
  const onPageHide = () => void ui.getState().flush();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
  };
}
