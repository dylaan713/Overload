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
  /** Local "today" as the store sees it (injectable for tests); views use it for dates and limits. */
  today(): string;
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
 * whole document; if the write fails, the change disappears again and saveError explains why.
 */
export function createAppStore(kv: KeyValueStore, opts: { today?: () => string; newId?: () => string } = {}): AppStore {
  const today = opts.today ?? (() => todayYmd());
  const newId = opts.newId ?? (() => crypto.randomUUID());
  let booting: Promise<void> | null = null;

  return createStore<AppState>()((set, get) => {
    // Every change is a function of the document. Writes run one at a time, each applied to the last
    // *saved* document, so a failed write can never leak into a later one. What's shown is always
    // "saved + changes still in flight", so memory and storage can't drift apart.
    let saved: StoreDoc | null = null;
    const inFlight: ((d: StoreDoc) => StoreDoc)[] = [];
    let queue: Promise<unknown> = Promise.resolve();
    const shown = () => inFlight.reduce((d, fn) => fn(d), saved!);

    function commit(fn: (d: StoreDoc) => StoreDoc): Promise<boolean> {
      if (get().status !== "ready" || !saved) {
        // Before boot finishes, or after it failed, a write could replace data we never loaded.
        set({ saveError: "Couldn't save: your data hasn't loaded" });
        return Promise.resolve(false);
      }
      inFlight.push(fn);
      set({ doc: fn(get().doc), saveError: null });
      const run = queue.then(async () => {
        const next = fn(saved!);
        try {
          await saveDoc(kv, next);
          saved = next;
          return true;
        } catch (e) {
          set({ saveError: `Couldn't save: ${message(e)}` });
          return false;
        } finally {
          inFlight.splice(inFlight.indexOf(fn), 1);
          set({ doc: shown() });
        }
      });
      queue = run;
      return run;
    }
    const mapExercise = (id: string, fn: (e: Exercise) => Exercise) =>
      commit((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

    return {
      status: "loading",
      error: null,
      bootKind: null,
      hasLegacy: false,
      warnings: [],
      doc: emptyDoc(today()),
      saveError: null,
      today,

      init() {
        booting ??= (async () => {
          try {
            const r = await bootStore(kv);
            const hasLegacy = await hasLegacyData(kv);
            saved = r.doc;
            set({ status: "ready", bootKind: r.kind, doc: r.doc, warnings: r.warnings, hasLegacy });
          } catch (e) {
            set({ status: "error", error: message(e) });
          }
        })();
        return booting;
      },

      updateSettings: (fn) => commit((d) => ({ ...d, settings: fn(d.settings) })),

      setUnit: (unit) => commit((d) => convertUnits(d, unit).doc),

      async startPhase(style) {
        const day = today();
        if (startPhaseIn(get().doc.settings, style, day) === get().doc.settings) return true;
        return commit((d) => ({ ...d, settings: startPhaseIn(d.settings, style, day) }));
      },

      async setPhaseStart(phaseId, date) {
        const day = today();
        const r = setPhaseStartIn(get().doc.settings, phaseId, date, day);
        if ("error" in r) return r.error;
        const apply = (d: StoreDoc) => {
          const next = setPhaseStartIn(d.settings, phaseId, date, day);
          return "error" in next ? d : { ...d, settings: next };
        };
        return (await commit(apply)) ? null : get().saveError;
      },

      async addFromLibrary(entry) {
        const state = libraryState(get().doc, entry.id);
        if (state.status === "added") return state.exerciseId;
        if (state.status === "archived") return (await get().setArchived(state.exerciseId, false)) ? state.exerciseId : null;
        const ex = exerciseFromLibrary(entry, newId());
        return (await commit((d) => (d.exercises.some((e) => e.libraryId === entry.id) ? d : { ...d, exercises: [...d.exercises, ex] }))) ? ex.id : null;
      },

      async addCustom(input) {
        const ex = customExercise(input, newId());
        if ("error" in ex) return ex;
        return (await commit((d) => ({ ...d, exercises: [...d.exercises, ex] }))) ? { id: ex.id } : { error: get().saveError ?? "Couldn't save" };
      },

      updateExercise: (id, patch) => mapExercise(id, (e) => ({ ...e, ...patch })),
      setArchived: (id, archived) => mapExercise(id, (e) => ({ ...e, archived })),
      deleteExercise: (id) => commit((d) => deleteExerciseCascade(d, id)),
      replaceDoc: (doc) => commit(() => doc),
      dismissSaveError: () => set({ saveError: null }),
    };
  });
}
