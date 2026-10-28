import { afterEach, describe, it, expect, vi } from "vitest";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { UI_KEY, createUiStore } from "../../src/state/uiStore";

afterEach(() => vi.useRealTimers());

describe("ui store", () => {
  it("persists the tab and restores it", async () => {
    const kv = createMemoryKV();
    const ui = createUiStore(kv);
    await ui.getState().hydrate();
    expect(ui.getState().tab).toBe("log");
    ui.getState().setTab("progress");
    await vi.waitFor(() => expect(JSON.parse(kv.dump()[UI_KEY]!)).toMatchObject({ version: 5, tab: "progress" }));
    const again = createUiStore(kv);
    await again.getState().hydrate();
    expect(again.getState().tab).toBe("progress");
  });

  it("falls back to log for an unknown stored tab", async () => {
    const ui = createUiStore(createMemoryKV({ [UI_KEY]: JSON.stringify({ version: 1, tab: "stats" }) }));
    await ui.getState().hydrate();
    expect(ui.getState().tab).toBe("log");
  });

  it("opens and closes the sheet without persisting it", async () => {
    const kv = createMemoryKV();
    const ui = createUiStore(kv);
    ui.getState().openSheet("settings");
    expect(ui.getState().sheet).toBe("settings");
    ui.getState().closeSheet();
    expect(ui.getState().sheet).toBeNull();
    expect(kv.dump()[UI_KEY]).toBeUndefined();
  });

  it("toasts auto-dismiss after 6 s; a new one replaces the old and restarts the timer", () => {
    vi.useFakeTimers();
    const ui = createUiStore(createMemoryKV());
    ui.getState().showToast({ text: "One" });
    const first = ui.getState().toast!;
    expect(first.text).toBe("One");
    vi.advanceTimersByTime(4000);
    ui.getState().showToast({ text: "Two" });
    expect(ui.getState().toast!.id).not.toBe(first.id);
    vi.advanceTimersByTime(4000);
    expect(ui.getState().toast!.text).toBe("Two");
    vi.advanceTimersByTime(2000);
    expect(ui.getState().toast).toBeNull();
    ui.getState().showToast({ text: "Three" });
    ui.getState().dismissToast();
    expect(ui.getState().toast).toBeNull();
  });

  it("storage errors never break hydrate or setTab", async () => {
    const broken: KeyValueStore = { get: async () => { throw new Error("nope"); }, set: async () => { throw new Error("nope"); } };
    const ui = createUiStore(broken);
    await expect(ui.getState().hydrate()).resolves.toBeUndefined();
    expect(() => ui.getState().setTab("history")).not.toThrow();
    expect(ui.getState().tab).toBe("history");
  });

  describe("repeat queue (v4)", () => {
    const draft = { day: "2026-10-19", exerciseId: "bench", weight: "185", reps: null, difficulty: null, warmup: false, editing: null, pending: null, test: false };

    it("persists the queue as version 4", async () => {
      const kv = createMemoryKV();
      const ui = createUiStore(kv);
      await ui.getState().hydrate();
      ui.getState().setQueue("2026-10-19", ["fly", "ohe"]);
      await ui.getState().flush();
      expect(JSON.parse(kv.dump()[UI_KEY]!)).toMatchObject({ version: 5, log: { queue: { day: "2026-10-19", ids: ["fly", "ohe"] } } });
      const again = createUiStore(kv);
      await again.getState().hydrate();
      expect(again.getState().log.queue).toEqual({ day: "2026-10-19", ids: ["fly", "ohe"] });
    });

    it("upgrades a v3 state, keeping the draft", async () => {
      const ui = createUiStore(createMemoryKV({ [UI_KEY]: JSON.stringify({ version: 3, tab: "log", log: { draft, startedAt: null, last: null } }) }));
      await ui.getState().hydrate();
      expect(ui.getState().log.draft).toEqual(draft);
      expect(ui.getState().log.queue).toBeNull();
    });

    it("drops a queue from another day than the draft, and a malformed one", async () => {
      const stale = createUiStore(createMemoryKV({ [UI_KEY]: JSON.stringify({ version: 4, tab: "log", log: { draft, startedAt: null, last: null, queue: { day: "2026-10-18", ids: ["fly"] } } }) }));
      await stale.getState().hydrate();
      expect(stale.getState().log.queue).toBeNull();
      const bad = createUiStore(createMemoryKV({ [UI_KEY]: JSON.stringify({ version: 4, tab: "log", log: { draft, startedAt: null, last: null, queue: { day: "2026-10-19", ids: [3] } } }) }));
      await bad.getState().hydrate();
      expect(bad.getState().log.queue).toBeNull();
      expect(bad.getState().log.draft).toEqual(draft);
    });

    it("unqueue removes one exercise and clears an empty queue", () => {
      const ui = createUiStore(createMemoryKV());
      ui.getState().setQueue("2026-10-19", ["fly", "ohe"]);
      ui.getState().unqueue("fly");
      expect(ui.getState().log.queue).toEqual({ day: "2026-10-19", ids: ["ohe"] });
      ui.getState().unqueue("ohe");
      expect(ui.getState().log.queue).toBeNull();
    });
  });
});
