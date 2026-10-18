// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { coachFor } from "../../src/domain/log";
import type { StoreDoc } from "../../src/domain/types";
import { UI_KEY, type LogUi } from "../../src/state/uiStore";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { failing, stored, type MemoryKV } from "../helpers/seed";

const TODAY = "2026-10-18";
const NOON = Date.parse("2026-10-18T12:00:00");
const row = ex("row", { name: "Seated cable row", equipment: "cable", primary: ["upper-back"] });
const curl = ex("curl", { name: "Curl", equipment: "dumbbell", primary: ["biceps"], class: "isolation" });
const history = () => doc({ exercises: [row, curl], sessions: [day("2026-10-10", [["row", sets(130, [10, 10, 9], [2, 2, 1])]])] });

function device(d: StoreDoc, log: Partial<LogUi> = {}): MemoryKV {
  return createMemoryKV({
    [V2_KEY]: JSON.stringify(d),
    [UI_KEY]: JSON.stringify({ version: 2, tab: "log", log: { draft: null, startedAt: null, last: null, ...log } }),
  });
}
const draftFor = (exerciseId: string, dayYmd = TODAY) => ({ day: dayYmd, exerciseId, weight: "", reps: "", difficulty: null, warmup: true, editing: null, test: false });
const open = (kv: MemoryKV, now = NOON, today = TODAY) => renderWithStore(<Shell />, { kv, today, now: () => now });
const target = () => screen.getByRole("region", { name: "Target" });
const lastTime = () => screen.getByRole("region", { name: "Last time" });

describe("log screen", () => {
  it("starts empty with a way to pick the first exercise", async () => {
    await open(device(doc({ exercises: [row] })));
    expect(screen.getByText("Start with any exercise")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "＋ Next exercise" })).toBeInTheDocument();
    expect(screen.queryByText(/Set \d of/)).toBeNull();
  });

  it("shows the target beside last time, the set count, the warm-up hint and warm-up on", async () => {
    const d = history();
    await open(device(d, { draft: draftFor("row") }));
    const t = coachFor(d, "row", TODAY, false).targets;
    expect(screen.getByRole("heading", { name: "Seated cable row" })).toBeInTheDocument();
    expect(target()).toHaveTextContent(`${t.weight} × ${t.sets[0]!.reps}`);
    expect(target()).toHaveTextContent("Moderate–All out");
    expect(lastTime()).toHaveTextContent("130 × 10");
    expect(lastTime()).toHaveTextContent("10 · 10 · 9");
    expect(screen.getByText(t.reason)).toBeInTheDocument();
    expect(screen.getByText(/^Set 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/^Warm-up: /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warm-up" })).toHaveAttribute("aria-pressed", "true");
  });

  it("logging a working set stores it, advances the set, and leaves the targets fixed for the day", async () => {
    const d = history();
    const { user, kv } = await open(device(d, { draft: draftFor("row") }));
    const t = coachFor(d, "row", TODAY, false).targets;
    const before = target().textContent;
    await user.click(screen.getByRole("button", { name: "Warm-up" }));
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(stored(kv).sessions.at(-1)!.blocks[0]!.sets).toEqual([{ weight: t.weight, reps: t.sets[0]!.reps, warmup: false, rir: 1 }]));
    expect(screen.getByText(/^Set 2 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/last set 0:00 ago/)).toBeInTheDocument();
    expect(screen.queryByText(/^Warm-up: /)).toBeNull();
    expect(screen.getByRole("button", { name: "Warm-up" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Reps")).toHaveAttribute("placeholder", String(t.sets[1]!.reps));
    expect(target().textContent).toBe(before);
    expect(screen.getByRole("button", { name: "Seated cable row" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a warm-up keeps warm-up on and doesn't count as a set", async () => {
    const { user, kv } = await open(device(history(), { draft: draftFor("row") }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(stored(kv).sessions.at(-1)!.blocks[0]!.sets[0]!.warmup).toBe(true));
    expect(screen.getByText(/^Set 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warm-up" })).toHaveAttribute("aria-pressed", "true");
  });

  it("first time on an exercise asks for a weight in plain words", async () => {
    await open(device(history(), { draft: draftFor("curl") }));
    expect(target()).toHaveTextContent("First time: pick a weight you could do for 10 reps");
    expect(document.body).not.toHaveTextContent(/left\.|RIR/);
  });

  it("a failed save keeps everything typed and logs nothing (review focus 3)", async () => {
    const inner = device(history(), { draft: draftFor("row") });
    const kv = Object.assign(failing(inner), { dump: inner.dump }) as unknown as MemoryKV;
    const { user, app } = await open(kv);
    await user.click(screen.getByRole("button", { name: "Warm-up" }));
    await user.type(screen.getByLabelText("lb"), "145");
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't save/));
    expect(screen.getByLabelText("lb")).toHaveValue("145");
    expect(screen.getByRole("radio", { name: "Hard" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/^Set 1 of 3/)).toBeInTheDocument();
    expect(app.getState().doc.sessions.some((s) => s.date === TODAY)).toBe(false);
  });

  it("a workout past midnight stays one workout for 3 hours (review focus 4)", async () => {
    const lastSet = Date.parse("2026-10-17T23:30:00");
    const d = doc({ exercises: [row], sessions: [day("2026-10-17", [["row", sets(130, [10])]])] });
    const ui = { draft: { ...draftFor("row", "2026-10-17"), weight: "135" }, startedAt: lastSet - 3_600_000, last: { day: "2026-10-17", at: lastSet } };
    const late = await open(device(d, ui), Date.parse("2026-10-18T00:40:00"));
    expect(screen.getByRole("button", { name: "Seated cable row" })).toBeInTheDocument();
    expect(screen.getByText(/^Set 2 of 3/)).toBeInTheDocument();
    expect(screen.getByLabelText("lb")).toHaveValue("135");
    late.unmount();
    await open(device(d, ui), Date.parse("2026-10-18T02:31:00"));
    expect(screen.getByText("Start with any exercise")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("135")).toBeNull();
  });

  it("an archived current exercise stays loggable; a deleted one falls back (review focus 5)", async () => {
    const d = doc({ exercises: [row, curl], sessions: [day(TODAY, [["curl", sets(30, [10])], ["row", sets(130, [10])]])] });
    const { app } = await open(device(d, { draft: draftFor("row") }));
    await act(async () => {
      await app.getState().setArchived("row", true);
    });
    expect(screen.getByRole("heading", { name: "Seated cable row" })).toBeInTheDocument();
    await act(async () => {
      await app.getState().deleteExercise("row");
    });
    expect(screen.getByRole("heading", { name: "Curl" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Today's exercises" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["Curl"]);
  });

  it("chips switch the current exercise", async () => {
    const d = doc({ exercises: [row, curl], sessions: [day(TODAY, [["curl", sets(30, [10])], ["row", sets(130, [10])]])] });
    const { user } = await open(device(d));
    expect(screen.getByRole("heading", { name: "Seated cable row" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Curl" }));
    expect(screen.getByRole("heading", { name: "Curl" })).toBeInTheDocument();
    expect(screen.getByText(/^Set 2 of/)).toBeInTheDocument();
  });

  it("a half-typed weight comes back after a reload (review focus 1)", async () => {
    const kv = device(history(), { draft: draftFor("row") });
    const first = await open(kv);
    await first.user.type(screen.getByLabelText("lb"), "14");
    await first.uiStore.getState().flush();
    first.unmount();
    await open(kv);
    expect(screen.getByLabelText("lb")).toHaveValue("14");
  });
});
