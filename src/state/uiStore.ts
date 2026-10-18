import { createStore, type StoreApi } from "zustand/vanilla";
import type { KeyValueStore } from "../data/kv";
import type { Difficulty } from "../domain/difficulty";
import type { SetRef } from "../domain/log";

export const UI_KEY = "overload.v2.ui";
export type Tab = "log" | "progress" | "history";
export type SheetId = "settings";
export interface Toast {
  id: string;
  text: string;
  action?: { label: string; onAction(): void };
}

/** What's on the Log's entry row, kept on every keystroke so nothing typed is lost. */
export interface LogDraft {
  day: string;
  exerciseId: string | null;
  weight: string;
  reps: string;
  difficulty: Difficulty | null;
  warmup: boolean;
  editing: SetRef | null;
  test: boolean;
}

export interface LogUi {
  draft: LogDraft | null;
  startedAt: number | null; // first set of the Log's day, for the workout clock
  last: { day: string; at: number } | null; // the latest logged set
}

export interface UiState {
  tab: Tab;
  sheet: SheetId | null;
  toast: Toast | null;
  log: LogUi;
  now(): number;
  setTab(tab: Tab): void;
  openSheet(sheet: SheetId): void;
  closeSheet(): void;
  showToast(toast: Omit<Toast, "id">): void;
  dismissToast(): void;
  setDraft(patch: Partial<LogDraft> & { day: string }): void;
  /** Back to an empty entry row, keeping the exercise, warm-up and test choices. */
  clearDraftFields(): void;
  markLogged(day: string, at: number): void;
  /** Writes any pending change now. */
  flush(): Promise<void>;
  hydrate(): Promise<void>;
}

export type UiStore = StoreApi<UiState>;

const TABS: readonly Tab[] = ["log", "progress", "history"];
const TOAST_MS = 6000;
export const DRAFT_DEBOUNCE_MS = 250;
const EMPTY_LOG: LogUi = { draft: null, startedAt: null, last: null };

const newDraft = (day: string): LogDraft => ({ day, exerciseId: null, weight: "", reps: "", difficulty: null, warmup: true, editing: null, test: false });

/** Transient UI state: never in backups, and its storage errors never block the app. */
export function createUiStore(kv: KeyValueStore, opts: { now?: () => number } = {}): UiStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let toastSeq = 0;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return createStore<UiState>()((set, get) => {
    const write = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      const { tab, log } = get();
      return kv.set(UI_KEY, JSON.stringify({ version: 2, tab, log })).catch(() => {});
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
      toast: null,
      log: EMPTY_LOG,
      now: opts.now ?? (() => Date.now()),

      setTab(tab) {
        set({ tab });
        void write();
      },
      openSheet: (sheet) => set({ sheet }),
      closeSheet: () => set({ sheet: null }),

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
        const { log } = get();
        const base = log.draft && log.draft.day === patch.day ? log.draft : newDraft(patch.day);
        setLog({ ...log, draft: { ...base, ...patch } });
      },
      clearDraftFields() {
        const { log } = get();
        if (log.draft) setLog({ ...log, draft: { ...log.draft, weight: "", reps: "", difficulty: null, editing: null } });
      },
      markLogged(day, at) {
        const { log } = get();
        setLog({ ...log, startedAt: log.last?.day === day && log.startedAt != null ? log.startedAt : at, last: { day, at } });
      },
      flush: () => write(),

      async hydrate() {
        try {
          const raw = await kv.get(UI_KEY);
          const saved = raw ? (JSON.parse(raw) as { version?: number; tab?: string; log?: LogUi }) : null;
          if ((saved?.version === 1 || saved?.version === 2) && TABS.includes(saved.tab as Tab)) set({ tab: saved.tab as Tab });
          // Anything typed before hydrate finished wins over the stored draft.
          if (saved?.version === 2 && saved.log && typeof saved.log === "object" && get().log.draft === null) {
            set({ log: { draft: saved.log.draft ?? null, startedAt: saved.log.startedAt ?? null, last: saved.log.last ?? null } });
          }
        } catch {
          // Transient state only: start on the defaults.
        }
      },
    };
  });
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
