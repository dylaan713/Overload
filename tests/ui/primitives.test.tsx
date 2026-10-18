// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../../src/ui/Card";
import { EmptyState } from "../../src/ui/EmptyState";
import { Field, Input, fieldErrorId } from "../../src/ui/Field";
import { Pill } from "../../src/ui/Pill";

describe("primitives", () => {
  it("Card renders an optional title", () => {
    render(<Card title="Units">body</Card>);
    expect(screen.getByRole("heading", { name: "Units" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
  it("Field associates its label with the control and shows an error", () => {
    render(
      <Field label="Name" htmlFor="n" error="Required">
        <Input id="n" defaultValue="" aria-describedby={fieldErrorId("n")} />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Required");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
  it("Pill renders its label", () => {
    render(<Pill tone="accent">Added</Pill>);
    expect(screen.getByText("Added")).toBeInTheDocument();
  });
  it("EmptyState shows its text", () => {
    render(<EmptyState text="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});
