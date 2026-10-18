// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { libraryView } from "../../src/features/exercises/LibraryView";
import { settingsView } from "../../src/features/settings/SettingsRoot";
import { SheetStack } from "../../src/ui/SheetStack";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { failing, stored } from "../helpers/seed";

const open = (opts: Parameters<typeof renderWithStore>[1] = {}) =>
  renderWithStore(<SheetStack root={libraryView()} onClose={() => {}} />, { today: "2026-10-17", ...opts });
const raise = ex("raise", { name: "Lateral raise (dumbbell)", libraryId: "lateral-raise.dumbbell", equipment: "dumbbell", primary: ["side-delts"], class: "isolation" });
const bench = ex("bench", { name: "Bench press (barbell)", libraryId: "bench-press.barbell", primary: ["chest"], secondary: ["triceps"] });
const addButton = () => screen.getAllByRole("button", { name: "Add exercise" })[0]!;

describe("library list", () => {
  it("shows an empty state with a way to add", async () => {
    await open();
    expect(screen.getByText("No exercises yet. Add one from the library.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add exercise" }).length).toBeGreaterThan(0);
  });

  it("lists my exercises by region with equipment and muscles", async () => {
    await open({ doc: doc({ exercises: [raise, bench] }) });
    expect(screen.getByRole("region", { name: "Chest" })).toBeInTheDocument();
    const shoulders = screen.getByRole("region", { name: "Shoulders" });
    expect(within(shoulders).getByRole("button", { name: /Lateral raise \(dumbbell\)/ })).toHaveTextContent("Dumbbell · Side delts");
  });
});

describe("adding from the library", () => {
  it("finds by alias and adds a single-equipment match", async () => {
    const { user, kv, uiStore } = await open();
    await user.click(addButton());
    await user.type(screen.getByRole("searchbox"), "db bench");
    await user.click(screen.getByRole("button", { name: /^Bench press \(dumbbell\)/ }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Exercise library" })).toBeInTheDocument());
    expect(stored(kv).exercises.map((e) => e.libraryId)).toEqual(["bench-press.dumbbell"]);
    expect(uiStore.getState().toast?.text).toBe("Added Bench press (dumbbell)");
  });

  it("chooses equipment when a movement has several", async () => {
    const { user, kv } = await open();
    await user.click(addButton());
    await user.type(screen.getByRole("searchbox"), "lateral raise");
    await user.click(screen.getByRole("button", { name: /^Lateral raise.*3 options/ }));
    expect(screen.getByRole("dialog", { name: "Lateral raise" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Lateral raise \(cable\)/ }));
    await waitFor(() => expect(stored(kv).exercises.map((e) => e.libraryId)).toEqual(["lateral-raise.cable"]));
  });

  it("an exercise already added can't be added twice; an archived one is restored", async () => {
    const archived = { ...bench, archived: true };
    const { user, kv } = await open({ doc: doc({ exercises: [raise, archived] }) });
    await user.click(addButton());
    await user.type(screen.getByRole("searchbox"), "lateral raise");
    await user.click(screen.getByRole("button", { name: /^Lateral raise.*3 options/ }));
    expect(screen.getByRole("button", { name: /^Lateral raise \(dumbbell\)/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Lateral raise \(dumbbell\)/ })).toHaveTextContent("Added");
    await user.click(screen.getByRole("button", { name: "Add exercise" })); // Back to the search
    const search = await screen.findByRole("searchbox");
    await user.clear(search);
    await user.type(search, "bench press barbell");
    await user.click(screen.getByRole("button", { name: "Restore Bench press (barbell)" }));
    await waitFor(() => expect(stored(kv).exercises.find((e) => e.id === "bench")!.archived).toBe(false));
    expect(stored(kv).exercises).toHaveLength(2);
  });
});

describe("create your own", () => {
  it("validates every required field and writes nothing until valid", async () => {
    const { user, kv } = await open();
    await user.click(addButton());
    await user.click(screen.getByRole("button", { name: /Can't find it\? Create your own/ }));
    expect(screen.getByRole("dialog", { name: "New exercise" })).toBeInTheDocument();
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Name can't be empty")).toBeInTheDocument();
    expect(screen.getByText("Pick at least one muscle worked")).toBeInTheDocument();
    expect(screen.getByText("Pick compound or isolation")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus(); // takes you to the first problem
    expect(kv.dump()[V2_KEY]).toBe(before);
    await user.type(screen.getByLabelText("Name"), "Landmine press");
    await user.selectOptions(screen.getByLabelText("Equipment"), "barbell");
    await user.click(within(screen.getByRole("group", { name: "Muscles worked" })).getByRole("button", { name: "Front delts" }));
    await user.click(screen.getByRole("radio", { name: "Compound" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(stored(kv).exercises[0]).toMatchObject({ name: "Landmine press", libraryId: null, equipment: "barbell", primary: ["front-delts"], class: "compound" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Shoulders" })).toHaveTextContent("Landmine press"));
  });
});

describe("exercise detail", () => {
  const openDetail = async (exercise = raise, opts: Parameters<typeof renderWithStore>[1] = {}) => {
    const r = await open({ doc: doc({ exercises: [exercise] }), ...opts });
    await r.user.click(screen.getByRole("button", { name: new RegExp(exercise.name.replace(/[()]/g, "\\$&")) }));
    return r;
  };

  it("refuses a blank name and an empty muscle list", async () => {
    const { user, kv } = await openDetail();
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.tab();
    expect(screen.getByText("Name can't be empty")).toBeInTheDocument();
    expect(stored(kv).exercises[0]!.name).toBe("Lateral raise (dumbbell)");
    await user.click(within(screen.getByRole("group", { name: "Muscles worked" })).getByRole("button", { name: "Side delts" }));
    expect(screen.getByText("Pick at least one muscle worked")).toBeInTheDocument();
    expect(stored(kv).exercises[0]!.primary).toEqual(["side-delts"]);
  });

  it("stores a step override and clears it with Use default", async () => {
    const { user, kv } = await openDetail();
    const step = screen.getByLabelText("Weight step");
    expect(step).toHaveAttribute("placeholder", "Default (5 lb)");
    await user.type(step, "2.5");
    await user.tab();
    await waitFor(() => expect(stored(kv).exercises[0]!.step).toBe(2.5));
    await user.click(screen.getByRole("button", { name: "Use default" }));
    await waitFor(() => expect(stored(kv).exercises[0]!.step).toBeNull());
  });

  it("a library exercise keeps its equipment; a custom one can change it", async () => {
    await openDetail();
    expect(screen.getByText("From the library · Dumbbell")).toBeInTheDocument();
    expect(screen.queryByLabelText("Equipment")).toBeNull();
  });

  it("archives with Undo", async () => {
    const { user, kv, uiStore } = await openDetail();
    await user.click(screen.getByRole("button", { name: "Archive exercise" }));
    await waitFor(() => expect(stored(kv).exercises[0]!.archived).toBe(true));
    expect(screen.getByRole("button", { name: /Archived \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Shoulders" })).toBeNull();
    const toast = uiStore.getState().toast!;
    expect(toast.text).toBe("Archived Lateral raise (dumbbell)");
    await act(async () => toast.action!.onAction());
    await waitFor(() => expect(stored(kv).exercises[0]!.archived).toBe(false));
  });

  it("a failed archive shows no toast and keeps the exercise listed", async () => {
    const kv = createMemoryKV({ [V2_KEY]: JSON.stringify(doc({ exercises: [raise] })) });
    const { user, app, uiStore } = await renderWithStore(<SheetStack root={libraryView()} onClose={() => {}} />, { kv: { ...kv, ...failing(kv), dump: kv.dump } as typeof kv });
    await user.click(screen.getByRole("button", { name: /Lateral raise \(dumbbell\)/ }));
    await user.click(screen.getByRole("button", { name: "Archive exercise" }));
    await waitFor(() => expect(app.getState().saveError).toMatch(/^Couldn't save:/));
    expect(uiStore.getState().toast).toBeNull();
    expect(app.getState().doc.exercises[0]!.archived).toBe(false);
  });

  it("deletes permanently only after a confirmation that states the cost", async () => {
    const d = doc({ exercises: [raise, bench], sessions: [day("2026-10-01", [["raise", sets(15, [12])]]), day("2026-10-03", [["raise", sets(15, [12])], ["bench", sets(100, [5])]])] });
    const { user, kv } = await open({ doc: d });
    await user.click(screen.getByRole("button", { name: /Lateral raise \(dumbbell\)/ }));
    await user.click(screen.getByRole("button", { name: "Delete permanently…" }));
    expect(screen.getByText("Deletes Lateral raise (dumbbell) and its 2 logged sessions. This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(stored(kv).exercises).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Delete permanently…" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(stored(kv).exercises.map((e) => e.id)).toEqual(["bench"]));
    expect(stored(kv).sessions.map((s) => s.date)).toEqual(["2026-10-03"]);
  });
});

describe("inside Settings (the real path)", () => {
  it("adding, creating and archiving return to the library, not to Settings", async () => {
    const { user, kv } = await renderWithStore(<SheetStack root={settingsView()} onClose={() => {}} />, { today: "2026-10-17" });
    await user.click(screen.getByRole("button", { name: /Exercise library/ }));
    await user.click(addButton());
    await user.type(screen.getByRole("searchbox"), "db bench");
    await user.click(screen.getByRole("button", { name: /^Bench press \(dumbbell\)/ }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Exercise library" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Bench press \(dumbbell\)/ }));
    await user.click(screen.getByRole("button", { name: "Archive exercise" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Exercise library" })).toBeInTheDocument());
    expect(stored(kv).exercises[0]!.archived).toBe(true);
  });
});

