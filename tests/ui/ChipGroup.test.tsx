// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipGroup } from "../../src/ui/ChipGroup";

const options = [
  { value: "chest", label: "Chest" },
  { value: "triceps", label: "Triceps" },
  { value: "lats", label: "Lats", disabled: true },
] as const;

describe("ChipGroup", () => {
  it("is a labelled group of toggle buttons", () => {
    render(<ChipGroup label="Muscles worked" options={[...options]} value={["triceps"]} onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Muscles worked" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Triceps" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Chest" })).toHaveAttribute("aria-pressed", "false");
  });

  it("adds in options order and removes on a second tap", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChipGroup label="M" options={[...options]} value={["triceps"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Chest" }));
    expect(onChange).toHaveBeenLastCalledWith(["chest", "triceps"]);
    rerender(<ChipGroup label="M" options={[...options]} value={["chest", "triceps"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Chest" }));
    expect(onChange).toHaveBeenLastCalledWith(["triceps"]);
  });

  it("can't toggle a disabled option", async () => {
    const onChange = vi.fn();
    render(<ChipGroup label="M" options={[...options]} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Lats" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an error as an alert", () => {
    render(<ChipGroup label="M" options={[...options]} value={[]} onChange={() => {}} error="Pick at least one muscle worked" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Pick at least one muscle worked");
    expect(screen.getByRole("group", { name: "M" })).toHaveAccessibleDescription("Pick at least one muscle worked");
  });
});
