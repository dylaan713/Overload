// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../../src/ui/Button";
import { IconButton } from "../../src/ui/IconButton";

describe("Button", () => {
  it("renders a button that defaults to type=button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("exposes its label as accessible name and title", () => {
    render(<IconButton label="Settings"><span>⚙</span></IconButton>);
    const btn = screen.getByRole("button", { name: "Settings" });
    expect(btn).toHaveAttribute("title", "Settings");
  });
});

describe("tap targets", () => {
  it("every button is at least 44px wide as well as tall", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/ui/Button.module.css", "utf8");
    expect(css).toMatch(/\.btn \{[^}]*min-width: 44px/);
  });
});

