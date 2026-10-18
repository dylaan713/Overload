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
