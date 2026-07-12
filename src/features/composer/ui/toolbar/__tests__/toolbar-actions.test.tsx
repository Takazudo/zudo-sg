/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import { ComposerToolbarActions } from "../toolbar-actions";

describe("ComposerToolbarActions", () => {
  it("calls onReset as a pure callback — no internal state", () => {
    const onReset = vi.fn();
    render(<ComposerToolbarActions onReset={onReset} onExport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("calls onExport as a pure callback", () => {
    const onExport = vi.fn();
    render(<ComposerToolbarActions onReset={vi.fn()} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Export JSX" }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("disables Export when exportDisabled is set", () => {
    render(<ComposerToolbarActions onReset={vi.fn()} onExport={vi.fn()} exportDisabled />);
    expect(screen.getByRole("button", { name: "Export JSX" })).toBeDisabled();
  });

  it("supports custom labels", () => {
    render(
      <ComposerToolbarActions onReset={vi.fn()} onExport={vi.fn()} resetLabel="Reset" exportLabel="Preview JSX" />,
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview JSX" })).toBeInTheDocument();
  });
});
