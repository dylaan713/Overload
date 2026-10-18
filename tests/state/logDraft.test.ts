// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { DRAFT_DEBOUNCE_MS, UI_KEY, createUiStore, watchHidden } from "../../src/state/uiStore";
import { failing } from "../helpers/seed";

afterEach(() => vi.useRealTimers());

const DAY = "2026-10-18";

async function reloaded(kv: KeyValueStore) {
  const ui = createUiStore(kv);
  await ui.getState().hydrate();
  return ui.getState();
}

describe("log draft", () => {
  it("every field round-trips through a reload", async () => {
    const kv = createMemoryKV();
    const ui = createUiStore(kv, { now: () => 1000 });
    await ui.getState().hydrate();
    ui.getState().setDraft({ day: DAY, exerciseId: "row", weight: "140", reps: "1", difficulty: "hard", warmup: false, test: true });
    ui.getState().setDraft({ day: DAY, editing: { day: DAY, blockId: "b", index: 2 } });
    ui.getState().markLogged(DAY, 1000);
    await ui.getState().flush();
    expect((await reloaded(kv)).log).toEqual(ui.getState().log);
    expect(ui.getState().log.draft).toEqual({
      day: DAY, exerciseId: "row", weight: "140", reps: "1", difficulty: "hard", warmup: false, editing: { day: DAY, blockId: "b", index: 2 }, pending: null, test: true,
    });
  });

  it("starts a draft with warm-up on and nothing typed", () => {
    const ui = createUiStore(createMemoryKV());
    ui.getState().setDraft({ day: DAY, exerciseId: "row" });
    expect(ui.getState().log.draft).toEqual({ day: DAY, exerciseId: "row", weight: "", reps: "", difficulty: null, warmup: true, editing: null, pending: null, test: false });
  });

  it("a keystroke right before the page is hidden is not lost", async () => {
    vi.useFakeTimers();
    const kv = createMemoryKV();
    const ui = createUiStore(kv);
    await ui.getState().hydrate();
    const stop = watchHidden(ui);
    ui.getState().setDraft({ day: DAY, weight: "14" });
    ui.getState().setDraft({ day: DAY, weight: "145" });
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0); // the write's promise, not the debounce
    stop();
    vi.useRealTimers();
    expect((await reloaded(kv)).log.draft?.weight).toBe("145");
  });

  it("also flushes when the document becomes hidden", async () => {
    vi.useFakeTimers();
    const kv = createMemoryKV();
    const ui = createUiStore(kv);
    await ui.getState().hydrate();
    const stop = watchHidden(ui);
    ui.getState().setDraft({ day: DAY, reps: "9" });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    stop();
    vi.useRealTimers();
    expect((await reloaded(kv)).log.draft?.reps).toBe("9");
  });

  it("debounces writes", async () => {
    vi.useFakeTimers();
    const inner = createMemoryKV();
    let writes = 0;
    const kv: KeyValueStore = { get: inner.get, set: (k, v) => { writes++; return inner.set(k, v); } };
    const ui = createUiStore(kv);
    await ui.getState().hydrate();
    writes = 0;
    for (const w of ["1", "14", "145", "145.", "145.5"]) ui.getState().setDraft({ day: DAY, weight: w });
    await vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS);
    expect(writes).toBe(1);
  });

  it("clearDraftFields keeps the exercise, warm-up and test choices", () => {
    const ui = createUiStore(createMemoryKV());
    ui.getState().setDraft({ day: DAY, exerciseId: "row", weight: "140", reps: "8", difficulty: "hard", warmup: false, test: true, editing: { day: DAY, blockId: "b", index: 0 } });
    ui.getState().clearDraftFields();
    expect(ui.getState().log.draft).toEqual({ day: DAY, exerciseId: "row", weight: "", reps: "", difficulty: null, warmup: false, editing: null, pending: null, test: true });
  });

  it("markLogged starts the workout clock on a new day only", () => {
    const ui = createUiStore(createMemoryKV());
    ui.getState().markLogged(DAY, 100);
    ui.getState().markLogged(DAY, 200);
    expect(ui.getState().log).toMatchObject({ startedAt: 100, last: { day: DAY, at: 200 } });
    ui.getState().markLogged("2026-10-19", 900);
    expect(ui.getState().log).toMatchObject({ startedAt: 900, last: { day: "2026-10-19", at: 900 } });
  });

  it("a version-1 file still restores the tab", async () => {
    const ui = createUiStore(createMemoryKV({ [UI_KEY]: JSON.stringify({ version: 1, tab: "history" }) }));
    await ui.getState().hydrate();
    expect(ui.getState().tab).toBe("history");
    expect(ui.getState().log).toEqual({ draft: null, startedAt: null, last: null });
  });

  const storedDraft = (weight: string) =>
    createMemoryKV({
      [UI_KEY]: JSON.stringify({
        version: 2, tab: "log",
        log: { draft: { day: DAY, exerciseId: "row", weight, reps: "", difficulty: null, warmup: true, editing: null, pending: null, test: false }, startedAt: 5, last: { day: DAY, at: 9 } },
      }),
    });

  it("a change before hydrate finishes never throws away or overwrites the saved draft (wave 1 review)", async () => {
    const kv = storedDraft("145");
    const ui = createUiStore(kv);
    ui.getState().setTab("history");
    await ui.getState().flush();
    await ui.getState().hydrate();
    expect(ui.getState().log).toMatchObject({ draft: { weight: "145" }, startedAt: 5, last: { at: 9 } });
    expect(ui.getState().tab).toBe("history");
    await ui.getState().flush();
    expect(JSON.parse(kv.dump()[UI_KEY]!)).toMatchObject({ tab: "history", log: { draft: { weight: "145" } } });
  });

  it("typing before hydrate finishes wins for the draft; the stored workout clock is kept", async () => {
    const kv = storedDraft("145");
    const ui = createUiStore(kv);
    ui.getState().setDraft({ day: DAY, weight: "150" });
    await ui.getState().hydrate();
    expect(ui.getState().log).toMatchObject({ draft: { weight: "150" }, startedAt: 5, last: { at: 9 } });
  });

  it("a malformed stored log is ignored, not crashed on (wave 1 review)", async () => {
    const ui = createUiStore(createMemoryKV({ [UI_KEY]: JSON.stringify({ version: 2, tab: "log", log: { draft: 5, startedAt: "x", last: { day: 1 } } }) }));
    await ui.getState().hydrate();
    expect(ui.getState().log).toEqual({ draft: null, startedAt: null, last: null });
  });

  it("storage errors never throw", async () => {
    const ui = createUiStore(failing(createMemoryKV()));
    await ui.getState().hydrate();
    ui.getState().setDraft({ day: DAY, weight: "1" });
    await expect(ui.getState().flush()).resolves.toBeUndefined();
  });
});
