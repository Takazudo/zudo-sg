import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MSG_READY, MSG_SET_THEME } from "../messages";
import DetailWorkbench, { type WorkbenchVariant } from "../detail-workbench";
import {
  ATTR_CODE_PANEL_HIDDEN,
  LS_CODE_PANEL_HIDDEN,
} from "../../chrome/panel-contract";

const FOUR_VARIANTS: WorkbenchVariant[] = [
  { exportName: "Default", name: "Default" },
  { exportName: "Compact", name: "Compact" },
  { exportName: "Wide", name: "Wide" },
  { exportName: "Empty", name: "Empty" },
];

/** Every stage's rendered viewport width, in document order. */
function stageWidths(): string[] {
  return screen
    .getAllByRole("region", { name: "Preview viewport canvas" })
    .map((region) => (region.firstElementChild as HTMLElement).style.width);
}

function themeSpies(): Array<ReturnType<typeof vi.spyOn>> {
  return screen
    .getAllByRole("region", { name: "Preview viewport canvas" })
    .map((region) => {
      const iframe = region.querySelector("iframe") as HTMLIFrameElement;
      const spy = vi
        .spyOn(iframe.contentWindow!, "postMessage")
        .mockImplementation(() => undefined);
      window.dispatchEvent(
        new MessageEvent("message", {
          source: iframe.contentWindow,
          data: { type: MSG_READY },
        }),
      );
      return spy;
    });
}

function lastTheme(spy: ReturnType<typeof vi.spyOn>): unknown {
  return spy.mock.calls
    .map(([message]) => message)
    .filter(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === MSG_SET_THEME,
    )
    .at(-1);
}

describe("DetailWorkbench", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.removeAttribute(ATTR_CODE_PANEL_HIDDEN);
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute(ATTR_CODE_PANEL_HIDDEN);
  });

  it("renders the global controls exactly once for a four-variant story", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    expect(screen.getAllByRole("group", { name: "Preview theme" })).toHaveLength(1);
    expect(
      screen.getAllByRole("group", { name: "Preview viewport" }),
    ).toHaveLength(1);
    expect(screen.getAllByRole("group", { name: "Preview layout" })).toHaveLength(1);
    expect(stageWidths()).toHaveLength(4);
  });

  it("keeps a variant's own story-prop controls with that variant", () => {
    render(
      <DetailWorkbench
        slug="cta-button"
        variants={[
          {
            exportName: "Playground",
            name: "Playground",
            controls: [
              {
                type: "text",
                prop: "children",
                label: "Label",
                defaultValue: "Browse products",
              },
            ],
          },
          { exportName: "Variants", name: "Variants" },
        ]}
      />,
    );

    // One stage declares a control, the other does not — the toolbar hoists
    // only the GLOBAL controls.
    expect(screen.getAllByLabelText("Label")).toHaveLength(1);
  });

  it("applies a toolbar viewport change to every stage at once", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    expect(stageWidths()).toEqual(["100%", "100%", "100%", "100%"]);

    fireEvent.click(
      screen
        .getByRole("group", { name: "Preview viewport" })
        .querySelector('button[aria-pressed="false"]')!,
    );

    expect(stageWidths()).toEqual(["320px", "320px", "320px", "320px"]);
  });

  it("applies a toolbar theme change to every stage at once", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);
    const spies = themeSpies();

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    for (const spy of spies) {
      expect(lastTheme(spy)).toEqual({ type: MSG_SET_THEME, theme: "light" });
    }
  });

  it("hands the CURRENT toolbar state to a stage that mounts after the change", () => {
    // The regression this island exists to prevent. Stages hydrate lazily, so
    // a toolbar that BROADCAST its state would be shouting into an empty room
    // for every stage still below the fold: the event fires once, before that
    // stage exists, and the stage silently keeps the default. Because the
    // state is owned here and flows down as props, a stage mounting after the
    // fact reads the current value on its very first render.
    const { rerender } = render(
      <DetailWorkbench slug="card" variants={FOUR_VARIANTS.slice(0, 2)} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(stageWidths()).toEqual(["768px", "768px"]);

    rerender(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    // The two stages that were never on screen when the toolbar moved.
    expect(stageWidths()).toEqual(["768px", "768px", "768px", "768px"]);

    const lateSpy = themeSpies()[3];
    expect(lastTheme(lateSpy)).toEqual({ type: MSG_SET_THEME, theme: "dark" });
  });

  it("switches the stage grid between stacked and multi-column", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    const grid = document.querySelector("[data-sg-stage-grid]") as HTMLElement;
    expect(grid.dataset.sgStageGrid).toBe("stacked");
    expect(grid.className).toContain("grid-cols-1");

    fireEvent.click(screen.getByRole("button", { name: "Grid" }));

    expect(grid.dataset.sgStageGrid).toBe("grid");
    expect(grid.className).toContain("auto-fit");
  });

  it("toggles the code panel from outside the panel and persists the state", async () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    const toggle = screen.getByRole("button", { name: /Code panel/ });
    // The toggle is in the toolbar, never inside `#sg-code-panel` — the CSS
    // that hides the panel would otherwise hide this control with it, for good.
    expect(toggle.closest("#sg-code-panel")).toBeNull();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(toggle);

    expect(
      document.documentElement.hasAttribute(ATTR_CODE_PANEL_HIDDEN),
    ).toBe(true);
    expect(localStorage.getItem(LS_CODE_PANEL_HIDDEN)).toBe("1");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

    fireEvent.click(toggle);

    expect(
      document.documentElement.hasAttribute(ATTR_CODE_PANEL_HIDDEN),
    ).toBe(false);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
  });

  it("reflects a code-panel state restored before hydration", async () => {
    document.documentElement.setAttribute(ATTR_CODE_PANEL_HIDDEN, "");

    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    const toggle = screen.getByRole("button", { name: /Code panel/ });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });

  it("opens the preview token panel on its own channel", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);
    const opened = vi.fn();
    window.addEventListener("toggle-preview-token-panel", opened);

    fireEvent.click(screen.getByRole("button", { name: /Preview tokens/ }));

    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener("toggle-preview-token-panel", opened);
  });
});
