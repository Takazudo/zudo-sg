// @vitest-environment happy-dom
//
// Accessible variant tabs (#900): tablist name, roving tabindex, arrow-key/
// Home/End navigation (moving focus AND activating in one keystroke), and
// the tab/tabpanel aria wiring. `SourceEditor` is stubbed — it dynamically
// imports the real CodeMirror graph on mount (see source-editor.tsx), which
// is unrelated to the tab behaviour under test here and would only make this
// suite slower and flakier.
//
// The engine's package default environment is `node` (vitest.config.ts); this
// package has no `jsdom` dependency at all, so every DOM suite here overrides
// per-file with `happy-dom` (the installed dep) instead — see
// `preview/__tests__/detail-workbench.test.tsx` for the same convention.
import "../../__tests__/dom-test-setup.js";
import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import CodePanel, { type CodePanelVariant } from "../code-panel.js";

vi.mock("../source-editor.js", () => ({
  default: ({ value, label }: { value: string; label?: string }) => (
    <pre aria-label={label}>{value}</pre>
  ),
}));

const THREE_VARIANTS: CodePanelVariant[] = [
  { exportName: "Default", name: "Default", source: "const a = 1;" },
  { exportName: "Compact", name: "Compact", source: "const b = 2;" },
  { exportName: "Wide", name: "Wide", source: "const c = 3;" },
];

function renderPanel(variants: CodePanelVariant[]) {
  return render(<CodePanel storyTitle="Card" variants={variants} slug="card" />);
}

describe("CodePanel variant tabs (#900)", () => {
  it("names the tablist \"Source variant\"", () => {
    renderPanel(THREE_VARIANTS);
    expect(screen.getByRole("tablist", { name: "Source variant" })).toBeTruthy();
  });

  it("gives only the selected tab tabindex 0", () => {
    renderPanel(THREE_VARIANTS);
    expect(screen.getByRole("tab", { name: "Default" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Compact" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Wide" })).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves selection and focus to the next tab, wrapping at the end", () => {
    renderPanel(THREE_VARIANTS);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Default" }), { key: "ArrowRight" });
    const compact = screen.getByRole("tab", { name: "Compact" });
    expect(compact).toHaveAttribute("aria-selected", "true");
    expect(compact).toHaveAttribute("tabindex", "0");
    expect(document.activeElement).toBe(compact);

    fireEvent.keyDown(compact, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Wide" }), { key: "ArrowRight" });
    const wrapped = screen.getByRole("tab", { name: "Default" });
    expect(wrapped).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(wrapped);
  });

  it("ArrowLeft moves selection and focus to the previous tab, wrapping at the start", () => {
    renderPanel(THREE_VARIANTS);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Default" }), { key: "ArrowLeft" });
    const wide = screen.getByRole("tab", { name: "Wide" });
    expect(wide).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(wide);
  });

  it("Home selects the first tab and End selects the last", () => {
    renderPanel(THREE_VARIANTS);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Default" }), { key: "End" });
    const wide = screen.getByRole("tab", { name: "Wide" });
    expect(wide).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(wide);

    fireEvent.keyDown(wide, { key: "Home" });
    const first = screen.getByRole("tab", { name: "Default" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(first);
  });

  it("wires aria-controls to the tabpanel and aria-labelledby to the active tab", () => {
    renderPanel(THREE_VARIANTS);

    const defaultTab = screen.getByRole("tab", { name: "Default" });
    const panel = screen.getByRole("tabpanel");
    expect(defaultTab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", defaultTab.id);

    fireEvent.keyDown(defaultTab, { key: "ArrowRight" });
    const compactTab = screen.getByRole("tab", { name: "Compact" });
    expect(compactTab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", compactTab.id);
  });

  it("renders no tablist and no tabpanel for a single variant", () => {
    renderPanel([THREE_VARIANTS[0]!]);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });
});

describe("CodePanel editor names + region hooks (#901)", () => {
  it("renders the stable source and live-CSS region hooks", () => {
    renderPanel(THREE_VARIANTS);
    expect(
      document.querySelector('.sg-code-source[data-sg-code-region="source"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('.sg-code-live-css[data-sg-code-region="live-css"]'),
    ).toBeTruthy();
  });

  it("renders the source region hook on the tabpanel wrapper when variants > 1", () => {
    renderPanel(THREE_VARIANTS);
    const region = document.querySelector('[data-sg-code-region="source"]');
    expect(region).toHaveAttribute("role", "tabpanel");
  });

  it("passes the source and Live CSS accessible names to SourceEditor", () => {
    renderPanel(THREE_VARIANTS);
    expect(
      screen.getByText("const a = 1;").closest("pre"),
    ).toHaveAttribute("aria-label", "Source code for Card: Default");
    expect(
      screen.getByText(/Live CSS —/).closest("pre"),
    ).toHaveAttribute("aria-label", "Live CSS for Card");
  });
});
