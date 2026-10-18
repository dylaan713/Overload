// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastView } from "../../src/ui/Toast";

describe("ToastView", () => {
  it("announces its text and action in a status region", () => {
    render(<ToastView toast={{ id: "1", text: "Archived Bench press", action: { label: "Undo", onAction: () => {} } }} onDismiss={() => {}} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Archived Bench press");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("the toast dismisses, then the action runs", async () => {
    const calls: string[] = [];
    const onDismiss = vi.fn(() => calls.push("dismiss"));
    render(<ToastView toast={{ id: "1", text: "x", action: { label: "Undo", onAction: () => calls.push("undo") } }} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(calls).toEqual(["dismiss", "undo"]); // dismiss first, so an action can show a follow-up toast
  });

  it("renders an empty status region when there's no toast", () => {
    render(<ToastView toast={null} onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("stacking", () => {
  it("toasts sit above an open sheet, so Undo stays reachable", async () => {
    const { readFileSync } = await import("node:fs");
    const z = (file: string, cls: string) => Number(readFileSync(file, "utf8").match(new RegExp(`\\.${cls} \\{[^}]*z-index: (\\d+)`))![1]);
    expect(z("src/ui/Toast.module.css", "region")).toBeGreaterThan(z("src/ui/Sheet.module.css", "layer"));
  });
});

