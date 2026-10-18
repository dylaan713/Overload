// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("toolchain", () => {
  it("renders TSX in jsdom with jest-dom matchers", () => {
    render(<h1>Overload</h1>);
    expect(screen.getByRole("heading", { name: "Overload" })).toBeInTheDocument();
  });
});
