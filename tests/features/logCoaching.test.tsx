// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { createMemoryKV } from "../../src/data/kv";
import { V2_KEY } from "../../src/data/store";
import type { StoreDoc } from "../../src/domain/types";
import { UI_KEY } from "../../src/state/uiStore";
import { day, doc, ex, sets, warm } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";
import { stored, type MemoryKV } from "../helpers/seed";

const TODAY = "2026-10-21"; // Wednesday; the week started Sunday the 18th
const NOW = Date.parse("2026-10-21T12:00:00");
const bench = ex("bench", { name: "Bench press" });
const dips = ex("dips", { name: "Dips", equipment: "bodyweight", loadKind: "bodyweight" });
const band = ex("band", { name: "Band pull-apart", equipment: "band", class: "isolation" });

const device = (d: StoreDoc, exerciseId: string | null = null): MemoryKV =>
  createMemoryKV({
    [V2_KEY]: JSON.stringify(d),
    [UI_KEY]: JSON.stringify({
      version: 2, tab: "log",
      log: { draft: exerciseId && { day: TODAY, exerciseId, weight: "", reps: "", difficulty: null, warmup: true, editing: null, pending: null, test: false }, startedAt: null, last: null },
    }),
  });
const open = (kv: MemoryKV) => renderWithStore(<Shell />, { kv, today: TODAY, now: () => NOW });
const benchHistory = () => doc({ exercises: [bench, dips, band], sessions: [day("2026-10-10", [["bench", sets(185, [5, 5, 5])]])] });

describe("test day", () => {
  it("isn't offered for bodyweight or band lifts", async () => {
    const { user } = await open(device(benchHistory(), "dips"));
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "＋ Next exercise" }));
    await user.click(await screen.findByRole("button", { name: /^Band pull-apart/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
  });

  it("before the first working set: the target becomes a work-up and the block is stored as a test", async () => {
    const { user, kv } = await open(device(benchHistory(), "bench"));
    await user.click(screen.getByRole("button", { name: "More options" }));
    await user.click(screen.getByRole("switch", { name: "Test day" }));
    expect(screen.getByRole("region", { name: "Target" })).toHaveTextContent(/Work up: [\d.]+ · [\d.]+ · [\d.]+/);
    await user.click(screen.getByRole("button", { name: "Warm-up" }));
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(stored(kv).sessions.at(-1)!.blocks[0]).toMatchObject({ exerciseId: "bench", test: true }));
    expect(stored(kv).sessions.at(-1)!.blocks[0]!.sets[0]!.reps).toBe(1);
  });

  it("a warm-up already logged still allows it", async () => {
    const d = benchHistory();
    d.sessions.push(day(TODAY, [["bench", [warm(95, 5)]]]));
    const { user, kv } = await open(device(d, "bench"));
    await user.click(screen.getByRole("button", { name: "More options" }));
    await user.click(screen.getByRole("switch", { name: "Test day" }));
    await waitFor(() => expect(stored(kv).sessions.at(-1)!.blocks[0]!.test).toBe(true));
    await user.click(screen.getByRole("switch", { name: "Test day" }));
    await waitFor(() => expect(stored(kv).sessions.at(-1)!.blocks[0]!.test).toBe(false));
  });

  it("after a working set it's locked, with the reason", async () => {
    const d = benchHistory();
    d.sessions.push(day(TODAY, [["bench", sets(185, [5])]]));
    const { user } = await open(device(d, "bench"));
    await user.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByRole("switch", { name: "Test day" })).toBeDisabled();
    expect(screen.getByText("Test day is chosen before your first working set")).toBeInTheDocument();
  });
});

describe("lighter-week suggestion", () => {
  const lift = (id: string) => ex(id, { name: id });
  const badWeek = () =>
    doc({
      exercises: ["a", "b", "c", "d"].map(lift),
      sessions: [
        day("2026-10-12", ["a", "b", "c", "d"].map((id) => [id, sets(100, [10, 10, 10])] as [string, ReturnType<typeof sets>])),
        day("2026-10-19", [["a", sets(100, [7, 7, 7])], ["b", sets(100, [7, 7, 7])], ["c", sets(100, [10, 10, 10])], ["d", sets(100, [10, 10, 10])]]),
      ],
    });

  it("appears for a bad week; Accept records it and switches targets to the lighter week", async () => {
    const { user, kv } = await open(device(badWeek(), "a"));
    expect(screen.getByText("Most lifts were down this week — take a lighter week?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(stored(kv).coaching.fatigueWeeks).toEqual([{ weekStart: "2026-10-18", status: "accepted", decidedOn: TODAY }]));
    expect(screen.queryByText("Most lifts were down this week — take a lighter week?")).toBeNull();
    expect(screen.getByText("Lighter week: 90% and half the sets.")).toBeInTheDocument();
  });

  it("Dismiss records it and it stays gone after a reload", async () => {
    const kv = device(badWeek(), "a");
    const first = await open(kv);
    await first.user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(stored(kv).coaching.fatigueWeeks[0]!.status).toBe("dismissed"));
    first.unmount();
    await open(kv);
    expect(screen.queryByText("Most lifts were down this week — take a lighter week?")).toBeNull();
  });

  it("today's half-finished workout can't trigger it", async () => {
    const d = badWeek();
    d.sessions = [d.sessions[0]!, { ...d.sessions[1]!, id: "today", date: TODAY }];
    await open(device(d, "a"));
    expect(screen.queryByText("Most lifts were down this week — take a lighter week?")).toBeNull();
  });
});
