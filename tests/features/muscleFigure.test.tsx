// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MuscleFigure, type Tone } from "../../src/features/progress/MuscleFigure";
import { MUSCLE_LABEL } from "../../src/domain/library/muscles";
import { MUSCLES, type Muscle } from "../../src/domain/types";

const tones = Object.fromEntries(MUSCLES.map((m) => [m, "none"])) as Record<Muscle, Tone>;
const labels = Object.fromEntries(MUSCLES.map((m) => [m, `${MUSCLE_LABEL[m]}, test`])) as Record<Muscle, string>;

describe("MuscleFigure", () => {
  it("gives every tracked muscle one named, focusable control", () => {
    render(<MuscleFigure tones={tones} labels={labels} selected={null} onSelect={() => {}} />);
    for (const m of MUSCLES) expect(screen.getAllByRole("button", { name: labels[m] })).toHaveLength(1);
  });

  it("selects a muscle by tap and by keyboard", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MuscleFigure tones={tones} labels={labels} selected={null} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: labels.chest }));
    expect(onSelect).toHaveBeenLastCalledWith("chest");
    screen.getByRole("button", { name: labels.calves }).focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("calves");
  });

  it("marks the selected muscle", () => {
    render(<MuscleFigure tones={tones} labels={labels} selected="lats" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: labels.lats })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: labels.chest })).toHaveAttribute("aria-pressed", "false");
  });

  it("fills each plate with its muscle's tone", () => {
    const { container } = render(<MuscleFigure tones={{ ...tones, quads: "l3" }} labels={labels} selected={null} onSelect={() => {}} />);
    const quads = container.querySelectorAll('[data-muscle="quads"] polygon:not([data-hit])');
    expect(quads.length).toBeGreaterThan(0);
    for (const p of quads) expect(p.getAttribute("fill")).toBe("var(--map-l3)");
  });

  it("gives small muscles a larger invisible hit area", () => {
    const { container } = render(<MuscleFigure tones={tones} labels={labels} selected={null} onSelect={() => {}} />);
    for (const m of ["rear-delts", "side-delts", "forearms", "calves"]) {
      const hit = container.querySelector(`[data-muscle="${m}"] [data-hit]`);
      expect(hit, m).not.toBeNull();
      expect(Number(hit!.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(8);
    }
  });
});
