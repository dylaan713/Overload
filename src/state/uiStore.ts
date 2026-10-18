import { createStore, type StoreApi } from "zustand/vanilla";
import type { KeyValueStore } from "../data/kv";

export const UI_KEY = "overload.v2.ui";
export type Tab = "log" | "progress" | "history";
export type SheetId = "settings";
export interface Toast {
  id: string;
  text: string;
  action?: { label: string; onAction(): void };
}

export interface UiState {
  tab: Tab;
  sheet: SheetId | null;
  toast: Toast | null;
  setTab(tab: Tab): void;
  openSheet(sheet: SheetId): void;
  closeSheet(): void;
  showToast(toast: Omit<Toast, "id">): void;
  dismissToast(): void;
  hydrate(): Promise<void>;
}

export type UiStore = StoreApi<UiState>;

const TABS: readonly Tab[] = ["log", "progress", "history"];
const TOAST_MS = 6000;

/** Transient UI state: never in backups, and its storage errors never block the app. */
export function createUiStore(kv: KeyValueStore): UiStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let toastSeq = 0;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return createStore<UiState>()((set) => ({
    tab: "log",
    sheet: null,
    toast: null,

    setTab(tab) {
      set({ tab });
      kv.set(UI_KEY, JSON.stringify({ version: 1, tab })).catch(() => {});
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

    async hydrate() {
      try {
        const raw = await kv.get(UI_KEY);
        const saved = raw ? (JSON.parse(raw) as { version?: number; tab?: string }) : null;
        if (saved?.version === 1 && TABS.includes(saved.tab as Tab)) set({ tab: saved.tab as Tab });
      } catch {
        // Transient state only: start on the default tab.
      }
    },
  }));
}
