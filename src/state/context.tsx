import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { KeyValueStore } from "../data/kv";
import type { AppState, AppStore } from "./appStore";
import type { UiState, UiStore } from "./uiStore";

interface Stores {
  app: AppStore;
  ui: UiStore;
  kv: KeyValueStore;
}

const Ctx = createContext<Stores | null>(null);

export function StoreProvider({ value, children }: { value: Stores; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useStores(): Stores {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider is missing");
  return v;
}

export const useApp = <T,>(selector: (s: AppState) => T): T => useStore(useStores().app, selector);
export const useUi = <T,>(selector: (s: UiState) => T): T => useStore(useStores().ui, selector);
export const useKv = (): KeyValueStore => useStores().kv;
export const useAppStore = (): AppStore => useStores().app;
export const useUiStore = (): UiStore => useStores().ui;
