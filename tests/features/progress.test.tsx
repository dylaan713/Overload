// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";

const TODAY = "2026-10-19";
const exercises = [
  ex("bench", { name: "Bench press", primary: ["chest"], secondary: ["triceps"] }),
  ex("squat", { name: "Squat", primary: ["quads"] }),
  ex("curl", { name: "Curl", class: "isolation", primary: ["biceps"] }),
];
const training = doc({
  exercises,
  sessions: [
    day("2026-09-01", [["bench", sets(135, [8, 8])], ["squat", sets(225, [5])]]),
    day("2026-09-15", [["bench", sets(135, [8, 8])], ["squat", sets(215, [5])], ["curl", sets(30, [10])]]),
    day("2026-10-01", [["bench", sets(140, [8, 8])], ["squat", sets(205, [5])]]),
    day("2026-10-15", [["bench", sets(145, [8, 8])], ["curl", sets(30, [10])]]),
  ],
});

async function openProgress(d = training) {
  const r = await renderWithStore(<Shell />, { doc: d, today: TODAY, now: () => Date.parse(`${TODAY}T12:00:00`) });
  await r.user.click(screen.getByRole("tab", { name: "Progress" }));
  return r;
}

describe("Progress tab", () => {
  it("shows one plain line on a new account, and the figure under Muscles", async () => {
    const { user } = await openProgress(doc({}));
    expect(screen.getByText("Log a few sessions to see progress here")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Muscles" }));
    expect(screen.getByRole("button", { name: /^Chest/ })).toBeInTheDocument();
    expect(screen.queryByText(/Stronger on/)).toBeNull();
  });

  it("answers the headline question", async () => {
    await openProgress();
    expect(screen.getByText("Stronger on 1 of 2 lifts")).toBeInTheDocument();
    expect(screen.getByText("Average est. 1RM −1%")).toBeInTheDocument();
  });

  it("lists lifts by sessions with their change", async () => {
    await openProgress();
    const lifts = screen.getByRole("region", { name: "Your lifts" });
    const rows = within(lifts).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Bench press.*\+13 lb/),
      expect.stringMatching(/^Squat.*−24 lb/),
      expect.stringMatching(/^Curl.*Not enough data yet/),
    ]);
  });

  it("says why a lift needs attention", async () => {
    await openProgress();
    const group = screen.getByRole("region", { name: "Needs attention" });
    expect(within(group).getByText("Squat")).toBeInTheDocument();
    expect(within(group).getByText(/^Quads short on sets: 0\.3 of 10\+ a week$/)).toBeInTheDocument();
  });

  it("opens on Lifts, with the muscle map one switch away", async () => {
    const { user } = await openProgress();
    expect(screen.getByRole("radio", { name: "Lifts" })).toBeChecked();
    expect(screen.queryByRole("button", { name: /^Chest/ })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Muscles" }));
    expect(screen.getByRole("button", { name: /^Chest/ })).toBeInTheDocument();
    expect(screen.queryByText(/Stronger on/)).toBeNull();
  });

  it("tells this week's sets for a tapped muscle", async () => {
    const { user } = await openProgress();
    await user.click(screen.getByRole("radio", { name: "Muscles" }));
    await user.click(screen.getByRole("button", { name: /^Side delts/ }));
    expect(screen.getByText("Side delts · 0 of 10–20 sets this week · add 10")).toBeInTheDocument();
  });

  it("switches to strength, with its own legend and the muscle's lifts", async () => {
    const { user } = await openProgress();
    await user.click(screen.getByRole("radio", { name: "Muscles" }));
    expect(screen.getByText("Under half")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Strength" }));
    for (const word of ["Down", "Flat", "Up", "Up a lot", "No data"]) expect(screen.getByText(word)).toBeInTheDocument();
    expect(screen.queryByText("Under half")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Chest/ }));
    const panel = screen.getByRole("region", { name: "Chest" });
    expect(within(panel).getByText("Bench press")).toBeInTheDocument();
    expect(within(panel).getByText("+13 lb")).toBeInTheDocument();
  });

  it("gives the full reason on the stuck lift's chart", async () => {
    const { user } = await openProgress();
    await user.click(within(screen.getByRole("region", { name: "Needs attention" })).getByRole("button", { name: /^Squat/ }));
    const why = within(await screen.findByRole("dialog")).getByRole("region", { name: "Why it's stuck" });
    expect(why).toHaveTextContent("Quads gets 0.3 of 10+ sets a week. Add sets.");
  });

  it("opens a lift's chart", async () => {
    const { user, uiStore } = await openProgress();
    await user.click(within(screen.getByRole("region", { name: "Your lifts" })).getByRole("button", { name: /^Bench press/ }));
    expect(uiStore.getState()).toMatchObject({ sheet: "lift", sheetArg: "bench" });
  });
});
