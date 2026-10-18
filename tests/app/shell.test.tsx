// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryKV, type KeyValueStore } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { App, downloadRaw } from "../../src/app/App";
import { ErrorBoundary } from "../../src/app/ErrorBoundary";
import { Shell } from "../../src/app/Shell";
import { doc, ex } from "../helpers/build";
import { blobText, captureDownloads } from "../helpers/blob";
import { renderWithStore } from "../helpers/renderWithStore";
import { seedLegacy } from "../helpers/seed";

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

const page = () => document.querySelector("[data-page]") as HTMLElement;

describe("tabs", () => {
  it("shows Log, Progress and History tabs and the Settings button", async () => {
    await renderWithStore(<Shell />);
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Log", "Progress", "History"]);
    expect(screen.getByRole("tab", { name: "Log" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("switches tabs, persists the choice and restores it", async () => {
    const { user, kv, unmount } = await renderWithStore(<Shell />);
    await user.click(screen.getByRole("tab", { name: "Progress" }));
    expect(screen.getByRole("tab", { name: "Progress" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 1, name: "Progress" })).toBeInTheDocument();
    unmount();
    await renderWithStore(<Shell />, { kv });
    expect(screen.getByRole("tab", { name: "Progress" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("settings sheet", () => {
  it("opens over an inert page; Done closes it and returns focus to the gear", async () => {
    const { user } = await renderWithStore(<Shell />);
    const gear = screen.getByRole("button", { name: "Settings" });
    await user.click(gear);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(page()).toHaveAttribute("inert");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(page()).not.toHaveAttribute("inert");
    expect(document.documentElement.style.getPropertyValue("--sheet-progress")).toBe("");
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus());
  });
});

describe("over the settings sheet (wave 3 review)", () => {
  // VoiceOver confines navigation to an aria-modal dialog; the inert page is what makes the sheet modal.
  const reachable = (el: HTMLElement) =>
    el.closest("[inert]") === null && Array.from(document.querySelectorAll('[aria-modal="true"]')).every((m) => m.contains(el));

  it("Undo and Dismiss stay reachable by assistive tech while the sheet is open", async () => {
    const { app, uiStore, user } = await renderWithStore(<Shell />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(page()).toHaveAttribute("inert");
    act(() => uiStore.getState().showToast({ text: "Archived Curl", action: { label: "Undo", onAction: () => {} } }));
    await act(async () => {
      app.setState({ saveError: "Couldn't save: QuotaExceededError" });
    });
    expect(reachable(screen.getByRole("button", { name: "Undo" }))).toBe(true);
    expect(reachable(within(screen.getByRole("alert")).getByRole("button", { name: "Dismiss" }))).toBe(true);
  });
});

describe("theme", () => {
  it("applies a stored light preference", async () => {
    const d = doc({});
    d.settings.theme = "light";
    await renderWithStore(<Shell />, { doc: d });
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});

describe("save errors and toasts", () => {
  it("a failed save shows a dismissible alert", async () => {
    const { app, user } = await renderWithStore(<Shell />, { doc: doc({ exercises: [ex("a")] }) });
    // The store sets saveError when a write fails (covered in appStore.test); here: the shell shows it.
    await act(async () => {
      app.setState({ saveError: "Couldn't save: QuotaExceededError" });
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save: QuotaExceededError");
    await user.click(within(alert).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the UI store's toast with its action", async () => {
    const { uiStore } = await renderWithStore(<Shell />);
    const onAction = vi.fn();
    act(() => uiStore.getState().showToast({ text: "Archived Curl", action: { label: "Undo", onAction } }));
    expect(screen.getByRole("status")).toHaveTextContent("Archived Curl");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("boot through App", () => {
  it("a device with only old app data opens the Log tab and adds only overload.v2", async () => {
    const kv = seedLegacy();
    const before = kv.dump();
    render(<App kv={kv} />);
    expect(await screen.findByRole("tab", { name: "Log" })).toBeInTheDocument();
    expect(screen.queryByText(/copied/i)).toBeNull();
    const after = kv.dump();
    for (const k of Object.keys(before)) expect(after[k]).toBe(before[k]);
    expect(Object.keys(after).filter((k) => !(k in before))).toEqual([V2_KEY]);
  });

  it("a corrupt document shows the error screen and the raw download includes overload.v2", async () => {
    const files = captureDownloads(vi);
    const kv = createMemoryKV({ [V2_KEY]: "{corrupt", settings: "{}" });
    render(<App kv={kv} />);
    await userEvent.click(await screen.findByRole("button", { name: "Download raw data" }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(JSON.parse(await blobText(files[0]!.blob))).toEqual({ settings: "{}", [V2_KEY]: "{corrupt" });
    expect(kv.dump()[V2_KEY]).toBe("{corrupt");
  });

  it("boots once under StrictMode double effects", async () => {
    const inner = createMemoryKV();
    let gets = 0;
    const kv: KeyValueStore = { get: (k) => { gets++; return inner.get(k); }, set: inner.set };
    render(<StrictMode><App kv={kv} /></StrictMode>);
    await screen.findByRole("tab", { name: "Log" });
    const once = gets;
    await new Promise((r) => setTimeout(r, 30));
    expect(gets).toBe(once);
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
  });
});

describe("ErrorBoundary", () => {
  it("renders a recoverable screen with the error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Boom = () => {
      throw new Error("kaboom");
    };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("heading", { name: "Something broke" })).toBeInTheDocument();
    expect(screen.getByText("kaboom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("offers the raw data too, in case stored data is what crashes it (wave 3 review)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const files = captureDownloads(vi);
    const kv = createMemoryKV({ [V2_KEY]: '{"v":2}', settings: "{}" });
    const Boom = () => {
      throw new Error("kaboom");
    };
    render(<ErrorBoundary onDownloadRaw={() => downloadRaw(kv)}><Boom /></ErrorBoundary>);
    await userEvent.click(screen.getByRole("button", { name: "Download raw data" }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(JSON.parse(await blobText(files[0]!.blob))).toEqual({ settings: "{}", [V2_KEY]: '{"v":2}' });
  });
});
