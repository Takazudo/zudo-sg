/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/preact";
import { ComposerStatusIndicator } from "../status-indicator";

describe("ComposerStatusIndicator", () => {
  it("announces an honest, human-readable status via aria-live", () => {
    render(<ComposerStatusIndicator saveStatus={{ kind: "saved" }} />);
    const status = screen.getByText("Saved locally");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("data-sg-status", "saved");
  });

  it("surfaces the unsaved status distinctly", () => {
    render(<ComposerStatusIndicator saveStatus={{ kind: "unsaved" }} />);
    expect(screen.getByText("Not saved yet")).toHaveAttribute("data-sg-status", "unsaved");
  });

  it("surfaces a storage error status", () => {
    render(<ComposerStatusIndicator saveStatus={{ kind: "error", reason: "quota exceeded" }} />);
    expect(screen.getByText(/local storage is unavailable/i)).toHaveAttribute("data-sg-status", "error");
  });

  it("is composable — a later status chip (e.g. wave-6 clipboard chip) can render beside it via children", () => {
    render(
      <ComposerStatusIndicator saveStatus={{ kind: "saved" }}>
        <span>Copied</span>
      </ComposerStatusIndicator>,
    );
    expect(screen.getByText("Saved locally")).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });
});
