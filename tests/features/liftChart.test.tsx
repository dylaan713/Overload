// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";

const TODAY = "2026-10-19";
const d = doc({
  exercises: [ex("bench", { name: "Bench press" }), ex("dip", { name: "Dip" })],
  phases: [
    { id: "p1", style: "hypertrophy", startDate: "2026-01-01" },
    { id: "p2", style: "strength", startDate: "2026-09-15" },
  ],
  sessions: [
    day("2026-01-10", [["bench", sets(165, [8])]]),
    day("2026-08-01", [["bench", sets(175, [8])], ["dip", sets(25, [8])]]),
    day("2026-09-10", [["bench", sets(185, [8]), true]]),
    day("2026-09-24", [["bench", sets(205, [6])]]),
    day("2026-10-15", [["bench", sets(200, [5])]]),
  ],
});

async function openLift(id = "bench") {
  const r = await renderWithStore(<Shell />, { doc: d, today: TODAY, now: () => Date.parse(`${TODAY}T12:00:00`) });
  r.uiStore.getState().openSheet("lift", { arg: id });
  const sheet = await screen.findByRole("dialog");
  return { ...r, sheet };
}

const points = (sheet: HTMLElement) => sheet.querySelectorAll("[data-point]").length;

describe("lift chart", () => {
  it("is titled with the lift and starts on 3 months", async () => {
    const { sheet } = await openLift();
    expect(within(sheet).getByRole("heading", { name: "Bench press" })).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "3 mo" })).toBeChecked();
    expect(points(sheet)).toBe(4);
  });

  it("changes range", async () => {
    const { sheet, user } = await openLift();
    await user.click(within(sheet).getByRole("radio", { name: "4 wk" }));
    expect(points(sheet)).toBe(2);
    await user.click(within(sheet).getByRole("radio", { name: "1 yr" }));
    expect(points(sheet)).toBe(5);
  });

  it("marks a new phase and a test day", async () => {
    const { sheet } = await openLift();
    expect(within(sheet).getByLabelText("New phase")).toBeInTheDocument();
    expect(within(sheet).getByLabelText(/Test day/)).toBeInTheDocument();
  });

  it("shows the best set and the last time", async () => {
    const { sheet } = await openLift();
    expect(within(sheet).getByText("Best set").closest("div")).toHaveTextContent("Best set205 × 6");
    expect(within(sheet).getByText("Last time").closest("div")).toHaveTextContent("Last time200 × 5");
  });

  it("reads a day's value, moving with the arrow keys", async () => {
    const { sheet, user } = await openLift();
    const chart = within(sheet).getByRole("slider", { name: "Est. 1RM" });
    expect(chart).toHaveAttribute("aria-valuetext", "Oct 15 · 233 lb");
    chart.focus();
    await user.keyboard("{ArrowLeft}");
    expect(chart).toHaveAttribute("aria-valuetext", "Sep 24 · 246 lb");
    await user.keyboard("{ArrowLeft}");
    expect(chart).toHaveAttribute("aria-valuetext", "Sep 10 · 234 lb · Test day");
  });

  it("says when a range has nothing to draw", async () => {
    const { sheet, user } = await openLift("dip");
    await user.click(within(sheet).getByRole("radio", { name: "4 wk" }));
    expect(within(sheet).getByText("Not enough data yet")).toBeInTheDocument();
  });
});
