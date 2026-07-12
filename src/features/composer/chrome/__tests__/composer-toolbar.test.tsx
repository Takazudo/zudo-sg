/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/preact";
import { ComposerToolbar } from "../composer-toolbar";

function renderToolbar(overrides: Partial<Parameters<typeof ComposerToolbar>[0]> = {}) {
  const onSetMode = vi.fn();
  const onSetViewport = vi.fn();
  const onReset = vi.fn();
  render(
    <ComposerToolbar
      documentName="Product overview"
      mode="edit"
      viewport="fluid"
      saveStatus={{ kind: "saved" }}
      onSetMode={onSetMode}
      onSetViewport={onSetViewport}
      onReset={onReset}
      {...overrides}
    />,
  );
  return { onSetMode, onSetViewport, onReset };
}

describe("ComposerToolbar", () => {
  it("shows the document name and an honest save status", () => {
    renderToolbar();
    expect(screen.getByText("Product overview")).toBeInTheDocument();
    expect(screen.getByText("Saved locally")).toBeInTheDocument();
  });

  it("shows a distinct 'not saved' status for quarantined storage", () => {
    renderToolbar({ saveStatus: { kind: "quarantined", foundSchemaVersion: 7 } });
    expect(screen.getByText(/not saved/i)).toBeInTheDocument();
  });

  it("the mode toggle reflects the current mode and calls onSetMode", () => {
    const { onSetMode } = renderToolbar({ mode: "edit" });
    const editButton = screen.getByRole("button", { name: "Edit" });
    const previewButton = screen.getByRole("button", { name: "Preview" });
    expect(editButton).toHaveAttribute("aria-pressed", "true");
    expect(previewButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(previewButton);
    expect(onSetMode).toHaveBeenCalledWith("preview");
  });

  it("the viewport select calls onSetViewport with the chosen value", () => {
    const { onSetViewport } = renderToolbar();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "mobile" } });
    expect(onSetViewport).toHaveBeenCalledWith("mobile");
  });

  it("the Reset sample button calls onReset", () => {
    const { onReset } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
