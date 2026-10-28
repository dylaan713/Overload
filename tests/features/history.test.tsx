// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { Shell } from "../../src/app/Shell";
import { day, doc, ex, sets } from "../helpers/build";
import { renderWithStore } from "../helpers/renderWithStore";

const TODAY = "2026-10-19";
const push = [
  ex("bench", { name: "Bench press", primary: ["chest"] }),
  ex("incline", { name: "Incline press", primary: ["chest"] }),
  ex("fly", { name: "Chest fly", primary: ["chest"] }),
  ex("ohe", { name: "Overhead extension", primary: ["triceps"] }),
  ex("pushdown", { name: "Pushdown", primary: ["triceps"] }),
  ex("lateral", { name: "Lateral raise", primary: ["side-delts"] }),
  ex("row", { name: "Row", primary: ["lats"] }),
];
const pushDay = (date: string) => day(date, [
  ["bench", sets(185, [8, 7])], ["incline", sets(65, [10, 9])], ["fly", sets(40, [12, 12])],
  ["ohe", sets(50, [12, 11])], ["pushdown", sets(60, [12, 12])], ["lateral", sets(20, [15, 14])],
]);
const training = doc({ exercises: push, sessions: [pushDay("2026-10-16"), day("2026-10-14", [["row", sets(135, [10])]]), pushDay("2026-09-18")] });

async function openHistory(d = training) {
  const r = await renderWithStore(<Shell />, { doc: d, today: TODAY, now: () => Date.parse(`${TODAY}T12:00:00`) });
  await r.user.click(screen.getByRole("tab", { name: "History" }));
  return r;
}

describe("History tab", () => {
  it("opens on this month with the latest workout selected", async () => {
    await openHistory();
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Friday, October 16, workout" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Chest, Triceps, Side delts · 6 exercises/ })).toBeInTheDocument();
  });

  it("has Sunday-first weekday headers", async () => {
    await openHistory();
    const heads = screen.getAllByRole("columnheader").map((h) => h.getAttribute("aria-label"));
    expect(heads).toEqual(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  });

  it("marks training days with a dot and leaves other days untappable", async () => {
    await openHistory();
    const wed = screen.getByRole("button", { name: "Wednesday, October 14, workout" });
    expect(wed.querySelector("[data-dot]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /October 15/ })).toBeNull();
    expect(screen.getByLabelText("Thursday, October 15, no workout")).toBeInTheDocument();
  });

  it("shows a tapped day's summary", async () => {
    const { user } = await openHistory();
    await user.click(screen.getByRole("button", { name: "Wednesday, October 14, workout" }));
    expect(screen.getByRole("button", { name: /Lats · 1 exercise/ })).toBeInTheDocument();
  });

  it("moves between months", async () => {
    const { user } = await openHistory();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { name: "September 2026" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Friday, September 18, workout" }));
    expect(screen.getByRole("button", { name: /Chest, Triceps, Side delts/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
  });

  it("keeps the month either side mounted, out of reach, so a swipe pulls one in", async () => {
    const { container, user } = await openHistory();
    const labels = () => Array.from(container.querySelectorAll("[role=grid]")).map((g) => g.getAttribute("aria-label"));
    const reachable = () => Array.from(container.querySelectorAll("[role=grid]")).map((g) => !g.hasAttribute("inert"));
    expect(labels()).toEqual(["September 2026", "October 2026", "November 2026"]);
    expect(reachable()).toEqual([false, true, false]);
    // September's workout is mounted beside October, but only October's day is reachable.
    expect(screen.queryByRole("button", { name: "Friday, September 18, workout" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(labels()).toEqual(["October 2026", "November 2026", "December 2026"]);
    expect(reachable()).toEqual([false, true, false]);
  });

  it("opens the workout", async () => {
    const { user, uiStore } = await openHistory();
    await user.click(screen.getByRole("button", { name: /6 exercises/ }));
    expect(uiStore.getState()).toMatchObject({ sheet: "workout", sheetArg: "2026-10-16" });
  });

  it("opens on the month of the latest workout (review minor 5)", async () => {
    const r = await renderWithStore(<Shell />, { doc: training, today: "2026-11-01", now: () => Date.parse("2026-11-01T12:00:00") });
    await r.user.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
  });

  it("names days without a workout on the grid cell itself (review minor 6)", async () => {
    await openHistory();
    const cell = screen.getAllByRole("gridcell").find((c) => c.textContent === "15")!;
    expect(cell).toHaveAttribute("aria-label", "Thursday, October 15, no workout");
  });

  it("says so when there's nothing yet", async () => {
    await openHistory(doc({}));
    expect(screen.getByText("No workouts logged yet")).toBeInTheDocument();
    expect(within(screen.getByRole("grid")).queryAllByRole("button")).toHaveLength(0);
  });
});
