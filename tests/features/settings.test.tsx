// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { V2_KEY } from "../../src/data/store";
import { settingsView } from "../../src/features/settings/SettingsRoot";
import { SheetStack } from "../../src/ui/SheetStack";
import { day, doc, ex, sets } from "../helpers/build";
import { blobText, captureDownloads } from "../helpers/blob";
import { renderWithStore } from "../helpers/renderWithStore";
import { stored } from "../helpers/seed";

const TODAY = "2026-10-17";
const open = (opts: Parameters<typeof renderWithStore>[1] = {}) =>
  renderWithStore(<SheetStack root={settingsView()} onClose={() => {}} />, { today: TODAY, ...opts });
const section = (name: string) => screen.getByRole("region", { name });

afterEach(() => vi.restoreAllMocks());

describe("training style", () => {
  it("choosing Strength starts a phase today", async () => {
    const { user, kv } = await open({ doc: doc({ phases: [{ id: "p", style: "hypertrophy", startDate: "2026-09-01" }] }) });
    expect(within(section("Training")).getByText("Hypertrophy since Sep 1")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Strength" }));
    await waitFor(() => expect(stored(kv).settings.phases.at(-1)).toMatchObject({ style: "strength", startDate: TODAY }));
    expect(screen.getByText("Strength since Oct 17")).toBeInTheDocument();
  });

  it("a future start date is refused inline and not saved", async () => {
    const { kv } = await open({ doc: doc({ phases: [{ id: "p", style: "hypertrophy", startDate: "2026-09-01" }] }) });
    const before = kv.dump()[V2_KEY];
    fireEvent.change(screen.getByLabelText("Started"), { target: { value: "2026-11-01" } });
    expect(await screen.findByText("Start date can't be in the future")).toBeInTheDocument();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });

  it("an earlier start date is saved", async () => {
    const { kv } = await open({ doc: doc({ phases: [{ id: "p", style: "hypertrophy", startDate: "2026-09-01" }] }) });
    fireEvent.change(screen.getByLabelText("Started"), { target: { value: "2026-08-20" } });
    await waitFor(() => expect(stored(kv).settings.phases[0]!.startDate).toBe("2026-08-20"));
  });
});

describe("style rules", () => {
  it("opens with Back, refuses low > high and fractional sets, saves valid values", async () => {
    const { user, kv } = await open({ doc: doc({ style: "hypertrophy" }) });
    await user.click(screen.getByRole("button", { name: /Style rules/ }));
    expect(screen.getByRole("dialog", { name: "Style rules" })).toBeInTheDocument();
    const compound = section("Compound");
    const low = within(compound).getByLabelText("Reps low");
    await user.clear(low);
    await user.type(low, "12");
    await user.tab();
    expect(within(compound).getByText("Low can't be above high")).toBeInTheDocument();
    expect(stored(kv).settings.styles.hypertrophy.compound.repLow).toBe(6);
    const setsField = within(compound).getByLabelText("Sets");
    await user.clear(setsField);
    await user.type(setsField, "2.5");
    await user.tab();
    expect(within(compound).getByText("Enter a whole number from 1 to 20")).toBeInTheDocument();
    const rest = within(compound).getByLabelText("Rest (seconds)");
    await user.clear(rest);
    await user.type(rest, "150");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.styles.hypertrophy.compound.restSeconds).toBe(150));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument());
  });

  it("a refused pair value stays pending and is saved with its partner once the pair is valid", async () => {
    const { user, kv } = await open({ doc: doc({ style: "hypertrophy" }) });
    await user.click(screen.getByRole("button", { name: /Style rules/ }));
    const compound = section("Compound");
    const low = within(compound).getByLabelText("Reps low");
    const high = within(compound).getByLabelText("Reps high");
    await user.clear(low);
    await user.type(low, "12");
    await user.tab();
    expect(within(compound).getByText("Low can't be above high")).toBeInTheDocument();
    const rest = within(compound).getByLabelText("Rest (seconds)");
    await user.clear(rest);
    await user.type(rest, "150");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.styles.hypertrophy.compound.restSeconds).toBe(150));
    expect(low).toHaveValue("12");
    expect(stored(kv).settings.styles.hypertrophy.compound.repLow).toBe(6);
    await user.clear(high);
    await user.type(high, "14");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.styles.hypertrophy.compound).toMatchObject({ repLow: 12, repHigh: 14 }));
    expect(low).toHaveValue("12");
    expect(within(compound).queryByText("Low can't be above high")).not.toBeInTheDocument();
  });

  it("aims with difficulty words, never RIR numbers", async () => {
    const { user, kv } = await open({ doc: doc({ style: "hypertrophy" }) });
    await user.click(screen.getByRole("button", { name: /Style rules/ }));
    const compound = section("Compound");
    const easiest = within(compound).getByLabelText("Aim for (easiest)");
    const hardest = within(compound).getByLabelText("Aim for (hardest)");
    expect(easiest).toHaveDisplayValue("Moderate");
    expect(hardest).toHaveDisplayValue("Hard");
    expect(screen.getByRole("dialog", { name: "Style rules" })).not.toHaveTextContent(/RIR/);
    await user.selectOptions(easiest, "Easy");
    await waitFor(() => expect(stored(kv).settings.styles.hypertrophy.compound.rirHigh).toBe(4));
  });

  it("refuses a hardest aim easier than the easiest, keeps it pending, and saves the pair once valid", async () => {
    const { user, kv } = await open({ doc: doc({ style: "hypertrophy" }) });
    await user.click(screen.getByRole("button", { name: /Style rules/ }));
    const compound = section("Compound");
    const easiest = within(compound).getByLabelText("Aim for (easiest)");
    const hardest = within(compound).getByLabelText("Aim for (hardest)");
    await user.selectOptions(hardest, "Easy");
    expect(within(compound).getByText("Hardest can't be easier than easiest")).toBeInTheDocument();
    expect(stored(kv).settings.styles.hypertrophy.compound).toMatchObject({ rirLow: 1, rirHigh: 2 });
    expect(hardest).toHaveDisplayValue("Easy");
    await user.selectOptions(easiest, "Easy");
    await waitFor(() => expect(stored(kv).settings.styles.hypertrophy.compound).toMatchObject({ rirLow: 4, rirHigh: 4 }));
    expect(within(compound).queryByText("Hardest can't be easier than easiest")).not.toBeInTheDocument();
  });

  it("weekly volume keeps a refused value pending and saves the pair once valid", async () => {
    const { user, kv } = await open({ doc: doc({ style: "hypertrophy" }) });
    await user.click(screen.getByRole("button", { name: /Style rules/ }));
    const volume = section("Weekly volume");
    const before = stored(kv).settings.styles.hypertrophy.volume;
    const low = within(volume).getByLabelText("Sets low");
    await user.clear(low);
    await user.type(low, String(before.high + 2));
    await user.tab();
    expect(within(volume).getByText("Low can't be above high")).toBeInTheDocument();
    expect(stored(kv).settings.styles.hypertrophy.volume).toEqual(before);
    const high = within(volume).getByLabelText("Sets high");
    await user.clear(high);
    await user.type(high, String(before.high + 4));
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.styles.hypertrophy.volume).toEqual({ low: before.high + 2, high: before.high + 4 }));
  });
});

describe("units", () => {
  it("switches at once when there's nothing to convert", async () => {
    const { user, kv } = await open();
    await user.click(screen.getByRole("radio", { name: "kg" }));
    await waitFor(() => expect(stored(kv).settings.unit).toBe("kg"));
    expect(stored(kv).settings.equipmentSteps.dumbbell).toBe(2);
  });

  it("asks before a switch would reset equipment steps you changed (wave 3 review)", async () => {
    const d = doc({});
    d.settings.equipmentSteps.dumbbell = 2.5;
    const { user, kv } = await open({ doc: d });
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("radio", { name: "kg" }));
    expect(screen.getByText("Switch to kg? 1 changed equipment step will reset to kg defaults.")).toBeInTheDocument();
    expect(kv.dump()[V2_KEY]).toBe(before);
    await user.click(screen.getByRole("button", { name: "Switch" }));
    await waitFor(() => expect(stored(kv).settings.unit).toBe("kg"));
    expect(stored(kv).settings.equipmentSteps.dumbbell).toBe(2);
  });

  it("confirms a conversion with the exact counts; Cancel changes nothing, Convert converts", async () => {
    const d = doc({
      exercises: [ex("a", { step: 2.5 })],
      sessions: [day("2026-10-01", [["a", sets(225, [5, 5, 5])]])],
    });
    const { user, kv } = await open({ doc: d });
    const before = kv.dump()[V2_KEY];
    await user.click(screen.getByRole("radio", { name: "kg" }));
    expect(screen.getByText("Convert 3 logged sets to kg? Switching back restores the exact numbers. Equipment steps reset to kg defaults. 1 custom step will be cleared.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "lb" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(kv.dump()[V2_KEY]).toBe(before);
    await user.click(screen.getByRole("radio", { name: "kg" }));
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(stored(kv).settings.unit).toBe("kg"));
    expect(stored(kv).sessions[0]!.blocks[0]!.sets.map((s) => s.weight)).toEqual([102.1, 102.1, 102.1]);
  });
});

describe("equipment steps", () => {
  it("stores a valid step and refuses 0", async () => {
    const { user, kv } = await open();
    await user.click(screen.getByRole("button", { name: /Equipment steps/ }));
    const dumbbell = screen.getByLabelText("Dumbbell (lb)");
    await user.clear(dumbbell);
    await user.type(dumbbell, "2.5");
    await user.tab();
    await waitFor(() => expect(stored(kv).settings.equipmentSteps.dumbbell).toBe(2.5));
    const barbell = screen.getByLabelText("Barbell (lb)");
    await user.clear(barbell);
    await user.type(barbell, "0");
    await user.tab();
    expect(screen.getByText("Enter a number 0.1 or higher")).toBeInTheDocument();
    expect(stored(kv).settings.equipmentSteps.barbell).toBe(5);
    expect(screen.queryByLabelText(/Band/)).toBeNull();
  });
});

describe("appearance", () => {
  it("stores the choice", async () => {
    const { user, kv } = await open();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(stored(kv).settings.theme).toBe("dark"));
  });
});

describe("data and backup", () => {
  const file = (text: string) => new File([text], "backup.json", { type: "application/json" });
  const pick = (f: File) => fireEvent.change(screen.getByTestId("import-file"), { target: { files: [f] } });

  it("exports a v2 file named with the local date", async () => {
    const files = captureDownloads(vi);
    const { user } = await open({ doc: doc({ exercises: [ex("a")] }) });
    await user.click(screen.getByRole("button", { name: "Export backup" }));
    expect(files[0]!.name).toMatch(/^overload-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await blobText(files[0]!.blob))).toMatchObject({ app: "overload", version: 2, exercises: [{ id: "a" }] });
  });

  it("refuses old-app and broken files and leaves data intact", async () => {
    const { kv } = await open();
    const before = kv.dump()[V2_KEY];
    pick(file(JSON.stringify({ app: "overload", version: 1, exercises: [] })));
    expect(await screen.findByText("This backup is from the old app and can't be imported")).toBeInTheDocument();
    pick(file("{nope"));
    expect(await screen.findByText("Backup file is not valid JSON")).toBeInTheDocument();
    expect(kv.dump()[V2_KEY]).toBe(before);
  });

  it("asks before replacing, showing what's in the file", async () => {
    const { user, kv, uiStore } = await open();
    const incoming = doc({ exercises: [ex("x"), ex("y")], sessions: [day("2026-10-01", [["x", sets(100, [5])]])] });
    const text = JSON.stringify({ app: "overload", version: 2, exportedAt: "x", ...incoming });
    pick(file(text));
    expect(await screen.findByText("Replace your data with this backup? It has 2 exercises and 1 session.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(stored(kv).exercises).toEqual([]);
    pick(file(text));
    await user.click(await screen.findByRole("button", { name: "Replace" }));
    await waitFor(() => expect(stored(kv).exercises.map((e) => e.id)).toEqual(["x", "y"]));
    expect(uiStore.getState().toast?.text).toBe("Backup imported");
  });

  it("offers the old app's data only when it exists, and downloads exactly those keys", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Download old app data" })).toBeNull();
  });

  it("downloads exactly the legacy keys", async () => {
    const files = captureDownloads(vi);
    const legacy = { exercises: "[1]", settings: '{"unit":"lb"}' };
    const { user } = await open({ legacy });
    await user.click(screen.getByRole("button", { name: "Download old app data" }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(files[0]!.name).toMatch(/^overload-old-app-data-/);
    expect(JSON.parse(await blobText(files[0]!.blob))).toEqual(legacy);
  });
});
