// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Segmented } from "../../src/ui/Segmented";

const options = [
  { value: "lb", label: "lb" },
  { value: "kg", label: "kg" },
] as const;

describe("Segmented", () => {
  it("exposes a radiogroup with the active option checked", () => {
    render(<Segmented label="Units" value="lb" options={[...options]} onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Units" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "lb" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "kg" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the chosen value", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Units" value="lb" options={[...options]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "kg" }));
    expect(onChange).toHaveBeenCalledWith("kg");
  });

  it("ArrowRight moves to the next option and calls onChange", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Units" value="lb" options={[...options]} onChange={onChange} />);
    screen.getByRole("radio", { name: "lb" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("kg");
  });

  it("value null checks no option and keeps the group reachable by Tab", () => {
    render(<Segmented label="Type" value={null} options={[...options]} onChange={() => {}} />);
    for (const r of screen.getAllByRole("radio")) expect(r).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "lb" })).toHaveAttribute("tabindex", "0");
  });
});
