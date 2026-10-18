// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberField, rangeMessage } from "../../src/ui/NumberField";

describe("rangeMessage", () => {
  it("describes the allowed range", () => {
    expect(rangeMessage(1, 7)).toBe("Enter a number from 1 to 7");
    expect(rangeMessage(5)).toBe("Enter a number 5 or higher");
    expect(rangeMessage(undefined, 9)).toBe("Enter a number 9 or lower");
    expect(rangeMessage()).toBe("Enter a number");
  });
});

describe("NumberField", () => {
  it("commits a valid number on blur", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} min={1} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "3");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("commits on Enter", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "4{Enter}");
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("accepts decimals", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Increment" value={5} min={0} onChange={onChange} />);
    const input = screen.getByLabelText("Increment");
    await userEvent.clear(input);
    await userEvent.type(input, "2.5");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it("rejects out-of-range input: explains, reverts, never calls onChange", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} min={1} max={7} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "9");
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number from 1 to 7");
    expect(input).toHaveValue("2");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("rejects empty and non-numeric input", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={2} onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "abc");
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("2");
  });

  it("clears the error when the user edits again", async () => {
    render(<NumberField label="Sets" value={2} min={1} onChange={() => {}} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    await userEvent.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(input, "1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows prop changes", () => {
    const { rerender } = render(<NumberField label="Sets" value={2} onChange={() => {}} />);
    rerender(<NumberField label="Sets" value={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Sets")).toHaveValue("5");
  });

  it("integer fields reject decimals with a whole-number message", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Sets" value={3} min={1} max={20} integer onChange={onChange} />);
    const input = screen.getByLabelText("Sets");
    await userEvent.clear(input);
    await userEvent.type(input, "2.5");
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number from 1 to 20");
  });

  it("optional fields commit null when emptied", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Weight step" value={2.5} min={0.1} optional placeholder="Default (5 lb)" onChange={onChange} />);
    const input = screen.getByLabelText("Weight step");
    expect(input).toHaveAttribute("placeholder", "Default (5 lb)");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an empty optional field for a null value", () => {
    render(<NumberField label="Weight step" value={null} optional onChange={() => {}} />);
    expect(screen.getByLabelText("Weight step")).toHaveValue("");
  });

  it("renders a suffix", () => {
    render(<NumberField label="Dumbbell" value={5} suffix="lb" onChange={() => {}} />);
    expect(screen.getByText("lb")).toBeInTheDocument();
  });
});

describe("rangeMessage for whole numbers", () => {
  it("says whole number", () => {
    expect(rangeMessage(1, 20, true)).toBe("Enter a whole number from 1 to 20");
    expect(rangeMessage(0, undefined, true)).toBe("Enter a whole number 0 or higher");
  });
});

describe("NumberField input rules (review fixes)", () => {
  const typeAndBlur = async (label: string, text: string) => {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    if (text) await userEvent.type(input, text);
    await userEvent.tab();
    return input;
  };

  it("accepts a comma decimal (iOS decimal keypad in comma locales)", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Step" value={5} min={0} onChange={onChange} />);
    await typeAndBlur("Step", "2,5");
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it("normalises the text to the committed number", async () => {
    render(<NumberField label="Step" value={5} min={0} onChange={() => {}} />);
    expect(await typeAndBlur("Step", "05.0")).toHaveValue("5");
  });

  it("rejects hex, exponent and other non-decimal forms", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Step" value={5} onChange={onChange} />);
    for (const t of ["0x10", "1e3", "Infinity", "2,5,0"]) await typeAndBlur("Step", t);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("describes the control with its error message", async () => {
    render(<NumberField label="Sets" value={2} min={1} max={7} onChange={() => {}} />);
    const input = await typeAndBlur("Sets", "9");
    expect(input).toHaveAccessibleDescription("Enter a number from 1 to 7");
  });
});

