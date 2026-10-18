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
    await vi.waitFor(() => expect(JSON.parse(kv.dump()[UI_KEY]!)).toMatchObject({ version: 3, tab: "progress" }));
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
});
