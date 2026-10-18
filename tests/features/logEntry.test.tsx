// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { EntryRow } from "../../src/features/log/EntryRow";
import { renderWithStore } from "../helpers/renderWithStore";

const DAY = "2026-10-18";

async function open(opts: { warmup?: boolean; placeholder?: { weight: number | null; reps: number | null }; mode?: "new" | "edit" } = {}) {
  const onSubmit = vi.fn();
  const r = await renderWithStore(
    <EntryRow day={DAY} exerciseId="row" unit="lb" prefill={opts.placeholder ?? { weight: null, reps: null }} mode={opts.mode ?? "new"} onSubmit={onSubmit} onCancel={() => {}} onDelete={() => {}} />,
  );
  act(() => r.uiStore.getState().setDraft({ day: DAY, exerciseId: "row", warmup: opts.warmup ?? false }));
  return { ...r, onSubmit };
}

describe("entry row", () => {
  it("logs a working set with its difficulty word stored as rir", async () => {
    const { user, onSubmit } = await open();
    await user.type(screen.getByLabelText("lb"), "145");
    await user.type(screen.getByLabelText("Reps"), "8");
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(onSubmit).toHaveBeenCalledWith({ weight: 145, reps: 8, warmup: false, rir: 1 });
  });

  it("needs a difficulty for a working set; none is preselected", async () => {
    const { user } = await open({ placeholder: { weight: 140, reps: 10 } });
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Moderate" }));
    expect(screen.getByRole("button", { name: "Log set" })).toBeEnabled();
  });

  it("an untouched field shows the target as real text and logs it", async () => {
    const { user, onSubmit } = await open({ placeholder: { weight: 140, reps: 10 } });
    expect(screen.getByLabelText("lb")).toHaveValue("140");
    expect(screen.getByLabelText("Reps")).toHaveValue("10");
    await user.click(screen.getByRole("radio", { name: "Easy" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(onSubmit).toHaveBeenCalledWith({ weight: 140, reps: 10, warmup: false, rir: 4 });
  });

  it("typing into a prefilled field replaces the target instead of adding to it", async () => {
    const { user, onSubmit } = await open({ placeholder: { weight: 140, reps: 10 } });
    await user.click(screen.getByLabelText("lb"));
    await user.keyboard("135");
    expect(screen.getByLabelText("lb")).toHaveValue("135");
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(onSubmit).toHaveBeenCalledWith({ weight: 135, reps: 10, warmup: false, rir: 1 });
  });

  it("a field cleared on purpose stays empty and must be filled", async () => {
    const { user, onSubmit, uiStore } = await open({ placeholder: { weight: 140, reps: 10 } });
    await user.clear(screen.getByLabelText("Reps"));
    expect(screen.getByLabelText("Reps")).toHaveValue("");
    expect(uiStore.getState().log.draft).toMatchObject({ weight: null, reps: "" });
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(screen.getByText("Enter a whole number 1 or higher")).toBeInTheDocument();
    expect(screen.getByLabelText("Reps")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("a warm-up takes no difficulty", async () => {
    const { user, onSubmit } = await open({ warmup: true, placeholder: { weight: 70, reps: 8 } });
    expect(screen.getByRole("button", { name: "Warm-up" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(onSubmit).toHaveBeenCalledWith({ weight: 70, reps: 8, warmup: true, rir: null });
  });

  it("difficulty shows with warm-up on; picking one makes it a working set", async () => {
    const { user, onSubmit } = await open({ warmup: true, placeholder: { weight: 140, reps: 10 } });
    expect(screen.getByRole("radiogroup", { name: "Difficulty" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    expect(screen.getByRole("button", { name: "Warm-up" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(onSubmit).toHaveBeenCalledWith({ weight: 140, reps: 10, warmup: false, rir: 1 });
  });

  it("turning warm-up on clears the difficulty", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Warm-up" }));
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(0);
  });

  it("refuses fractional reps and a missing weight, focusing the first bad field", async () => {
    const { user, onSubmit } = await open();
    await user.type(screen.getByLabelText("Reps"), "8.5");
    await user.click(screen.getByRole("radio", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "Log set" }));
    expect(screen.getByText("Enter a number 0 or higher")).toBeInTheDocument();
    expect(screen.getByText("Enter a whole number 1 or higher")).toBeInTheDocument();
    expect(screen.getByLabelText("lb")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("every keystroke lands in the draft at once", async () => {
    const { user, uiStore } = await open();
    await user.type(screen.getByLabelText("lb"), "14");
    expect(uiStore.getState().log.draft?.weight).toBe("14");
    await user.click(screen.getByRole("radio", { name: "All out" }));
    expect(uiStore.getState().log.draft?.difficulty).toBe("all-out");
  });

  it("edit mode offers Save, Cancel and Delete set", async () => {
    await open({ mode: "edit" });
    for (const name of ["Save", "Cancel", "Delete set"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log set" })).toBeNull();
  });

  it("never shows RIR", async () => {
    const { container } = await open();
    expect(container).not.toHaveTextContent(/RIR/);
  });
});
