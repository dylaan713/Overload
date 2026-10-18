import { createStore, type StoreApi } from "zustand/vanilla";
import { bootStore, hasLegacyData } from "../data/boot";
import type { KeyValueStore } from "../data/kv";
import { emptyDoc, saveDoc } from "../data/store";
import { todayYmd } from "../domain/dates";
import { deleteExerciseCascade, libraryState } from "../domain/exercises";
import { customExercise, exerciseFromLibrary, type LibraryExercise } from "../domain/library";
import { convertUnits, setPhaseStart as setPhaseStartIn, startPhase as startPhaseIn } from "../domain/settings";
import type { Exercise, Settings, StoreDoc, Style, Unit } from "../domain/types";

export type ExercisePatch = Partial<Pick<Exercise, "name" | "primary" | "secondary" | "step" | "equipment" | "class">>;
export type CustomInput = Parameters<typeof customExercise>[0];

export interface AppState {
  status: "loading" | "ready" | "error";
  error: string | null;
  bootKind: "v2" | "fresh" | null;
  hasLegacy: boolean;
  warnings: string[];
  doc: StoreDoc;
  saveError: string | null;
  init(): Promise<void>;
  updateSettings(fn: (s: Settings) => Settings): Promise<boolean>;
  setUnit(unit: Unit): Promise<boolean>;
  startPhase(style: Style): Promise<boolean>;
  setPhaseStart(phaseId: string, date: string): Promise<string | null>;
  addFromLibrary(entry: LibraryExercise): Promise<string | null>;
  addCustom(input: CustomInput): Promise<{ id: string } | { error: string }>;
  updateExercise(id: string, patch: ExercisePatch): Promise<boolean>;
  setArchived(id: string, archived: boolean): Promise<boolean>;
  deleteExercise(id: string): Promise<boolean>;
  replaceDoc(doc: StoreDoc): Promise<boolean>;
  dismissSaveError(): void;
}

export type AppStore = StoreApi<AppState>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The document plus every action that changes it. Each action shows the change at once, then writes the
 * whole document; if the write fails, the previous document comes back and saveError explains why.
 */
export function createAppStore(kv: KeyValueStore, opts: { today?: () => string; newId?: () => string } = {}): AppStore {
  const today = opts.today ?? (() => todayYmd());
  const newId = opts.newId ?? (() => crypto.randomUUID());
  let booting: Promise<void> | null = null;

  return createStore<AppState>()((set, get) => {
    async function commit(next: StoreDoc): Promise<boolean> {
      const prev = get().doc;
      set({ doc: next, saveError: null });
      try {
        await saveDoc(kv, next);
        return true;
      } catch (e) {
        set({ doc: prev, saveError: `Couldn't save: ${message(e)}` });
        return false;
      }
    }
    const mapExercise = (id: string, fn: (e: Exercise) => Exercise) =>
      commit({ ...get().doc, exercises: get().doc.exercises.map((e) => (e.id === id ? fn(e) : e)) });

    return {
      status: "loading",
      error: null,
      bootKind: null,
      hasLegacy: false,
      warnings: [],
      doc: emptyDoc(today()),
      saveError: null,

      init() {
        booting ??= (async () => {
          try {
            const r = await bootStore(kv);
            const hasLegacy = await hasLegacyData(kv);
            set({ status: "ready", bootKind: r.kind, doc: r.doc, warnings: r.warnings, hasLegacy });
          } catch (e) {
            set({ status: "error", error: message(e) });
          }
        })();
        return booting;
      },

      updateSettings: (fn) => commit({ ...get().doc, settings: fn(get().doc.settings) }),

      setUnit: (unit) => commit(convertUnits(get().doc, unit).doc),

      async startPhase(style) {
        const settings = startPhaseIn(get().doc.settings, style, today());
        return settings === get().doc.settings ? true : commit({ ...get().doc, settings });
      },

      async setPhaseStart(phaseId, date) {
        const r = setPhaseStartIn(get().doc.settings, phaseId, date, today());
        if ("error" in r) return r.error;
        return (await commit({ ...get().doc, settings: r })) ? null : get().saveError;
      },

      async addFromLibrary(entry) {
        const state = libraryState(get().doc, entry.id);
        if (state.status === "added") return state.exerciseId;
        if (state.status === "archived") return (await get().setArchived(state.exerciseId, false)) ? state.exerciseId : null;
        const ex = exerciseFromLibrary(entry, newId());
        return (await commit({ ...get().doc, exercises: [...get().doc.exercises, ex] })) ? ex.id : null;
      },

      async addCustom(input) {
        const ex = customExercise(input, newId());
        if ("error" in ex) return ex;
        return (await commit({ ...get().doc, exercises: [...get().doc.exercises, ex] })) ? { id: ex.id } : { error: get().saveError ?? "Couldn't save" };
      },

      updateExercise: (id, patch) => mapExercise(id, (e) => ({ ...e, ...patch })),
      setArchived: (id, archived) => mapExercise(id, (e) => ({ ...e, archived })),
      deleteExercise: (id) => commit(deleteExerciseCascade(get().doc, id)),
      replaceDoc: (doc) => commit(doc),
      dismissSaveError: () => set({ saveError: null }),
    };
  });
}
