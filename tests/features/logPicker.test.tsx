// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import { weeklyVolume } from "../../src/domain/volume";
import type { StoreDoc } from "../../src/domain/types";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { stored } from "../helpers/seed";

const TODAY = "2026-10-18";
const row = ex("row", { name: "Seated cable row", equipment: "cable", primary: ["upper-back"], secondary: ["lats"] });
const curl = ex("curl", { name: "Curl", equipment: "dumbbell", primary: ["biceps"], class: "isolation" });
const face = ex("face", { name: "Face pull", equipment: "cable", primary: ["rear-delts"], class: "isolation" });

const open = (d: StoreDoc) =>
  renderWithStore(<Shell />, { kv: createMemoryKV({ [V2_KEY]: JSON.stringify(d) }), today: TODAY, now: () => Date.parse("2026-10-18T12:00:00") });

async function openPicker(d: StoreDoc) {
  const r = await open(d);
  await r.user.click(screen.getByRole("button", { name: "＋ Next exercise" }));
  await screen.findByRole("dialog", { name: "Next exercise" });
  return r;
}

describe("next-exercise picker", () => {
  it("lists this week's short muscles, most short first, as sets/low", async () => {
    const d = doc({
      exercises: [row, curl, face],
      sessions: [day("2026-10-01", [["face", sets(20, [15])]]), day(TODAY, [["row", sets(130, [10, 10, 10, 10])], ["curl", sets(30, [10, 10, 10])]])],
    });
    await openPicker(d);
    const short = weeklyVolume(d, TODAY).filter((r) => r.status === "under").sort((a, b) => b.low - b.sets - (a.low - a.sets));
    expect(short.length).toBeGreaterThan(1);
    const items = within(screen.getByRole("region", { name: "Still short this week" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(short.map((r) => `${r.label}${Math.round(r.sets * 10) / 10}/${r.low}`));
  });

  it("says so when every trained muscle is on track", async () => {
    await openPicker(doc({ exercises: [row] }));
    expect(screen.getByText("Every muscle you train is on track this week")).toBeInTheDocument();
  });

  it("search filters my exercises on every keystroke; archived ones aren't offered", async () => {
    const { user } = await openPicker(doc({ exercises: [row, curl, { ...face, archived: true }] }));
    // Not focused on open: the keyboard would cover "Still short this week".
    expect(screen.getByRole("searchbox", { name: "Search your exercises" })).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: /Face pull/ })).toBeNull();
    await user.type(screen.getByRole("searchbox"), "cu");
    expect(screen.getByRole("button", { name: /^Curl/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Seated cable row/ })).toBeNull();
  });

  it("picking closes the sheet and makes the exercise current", async () => {
    const { user } = await openPicker(doc({ exercises: [row, curl] }));
    await user.click(screen.getByRole("button", { name: /^Curl/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { name: "Curl" })).toBeInTheDocument();
  });

  it("picking an exercise already done today adds no second block", async () => {
    const d = doc({ exercises: [row, curl], sessions: [day(TODAY, [["row", sets(130, [10])]])] });
    const { user, kv } = await openPicker(d);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Seated cable row/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Warm-up" })).toHaveAttribute("aria-pressed", "false"); // it already has a working set
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(stored(kv).sessions[0]!.blocks[0]!.sets).toHaveLength(2));
    expect(stored(kv).sessions[0]!.blocks).toHaveLength(1);
  });

  it("adding from the library inside the picker comes back to the Log with it current", async () => {
    const { user, kv } = await openPicker(doc({ exercises: [row] }));
    await user.click(screen.getByRole("button", { name: "Add from the library" }));
    await user.type(await screen.findByRole("searchbox", { name: "Search exercises" }), "db bench");
    await user.click(screen.getByRole("button", { name: /^Bench press \(dumbbell\)/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { name: "Bench press (dumbbell)" })).toBeInTheDocument();
    expect(stored(kv).exercises.map((e) => e.libraryId)).toContain("bench-press.dumbbell");
  });
});
