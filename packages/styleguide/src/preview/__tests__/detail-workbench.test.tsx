// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MSG_HEIGHT, MSG_READY, MSG_SET_THEME, PROTOCOL_VERSION } from "../messages.js";
import DetailWorkbench, { type WorkbenchVariant } from "../detail-workbench.js";
import {
  ATTR_CODE_PANEL_HIDDEN,
  LS_CODE_PANEL_HIDDEN,
} from "../../chrome/panel-contract.js";

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
          origin: window.location.origin,
          source: iframe.contentWindow,
          data: { type: MSG_READY },
        }),
      );
      return spy;
    });
}

function lastTheme(spy: ReturnType<typeof vi.spyOn>): unknown {
  return spy.mock.calls
    .map(([message]: unknown[]) => message)
    .filter(
      (message: unknown) =>
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
      expect(lastTheme(spy)).toEqual({ type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "light" });
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
    expect(lastTheme(lateSpy)).toEqual({ type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "dark" });
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
    render(
      <DetailWorkbench slug="card" variants={FOUR_VARIANTS} toolbar={{ codePanel: true }} />,
    );

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

    render(
      <DetailWorkbench slug="card" variants={FOUR_VARIANTS} toolbar={{ codePanel: true }} />,
    );

    const toggle = screen.getByRole("button", { name: /Code panel/ });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });

  it("opens the preview token panel on its own channel", () => {
    render(
      <DetailWorkbench slug="card" variants={FOUR_VARIANTS} toolbar={{ tokenPanel: true }} />,
    );
    const opened = vi.fn();
    window.addEventListener("toggle-preview-token-panel", opened);

    fireEvent.click(screen.getByRole("button", { name: /Preview tokens/ }));

    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener("toggle-preview-token-panel", opened);
  });

  it("forwards frameSandbox and frameAllow to every stage", () => {
    render(
      <DetailWorkbench
        slug="card"
        variants={FOUR_VARIANTS}
        frameSandbox={["allow-scripts", "allow-same-origin"]}
        frameAllow={["fullscreen"]}
      />,
    );

    const iframes = document.querySelectorAll("iframe");
    expect(iframes).toHaveLength(FOUR_VARIANTS.length);
    for (const iframe of iframes) {
      expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
      expect(iframe).toHaveAttribute("allow", "fullscreen");
    }
  });

  it("keeps the default sandbox and no allow attribute when neither is given", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    for (const iframe of document.querySelectorAll("iframe")) {
      expect(iframe).toHaveAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
      expect(iframe).not.toHaveAttribute("allow");
    }
  });
});

function iframes(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll("iframe"));
}

function postFromFrame(iframe: HTMLIFrameElement, data: unknown): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: iframe.contentWindow,
        data,
      }),
    );
  });
}

describe("DetailWorkbench host-controlled props (#883)", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.removeAttribute(ATTR_CODE_PANEL_HIDDEN);
    localStorage.clear();
  });

  it("with no props keeps today's output minus the two default-off pills", () => {
    render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);

    expect(screen.getAllByRole("group", { name: "Preview theme" })).toHaveLength(1);
    expect(screen.getAllByRole("group", { name: "Preview viewport" })).toHaveLength(1);
    expect(screen.getAllByRole("group", { name: "Preview layout" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Code panel/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Preview tokens/ })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(iframes().map((f) => f.getAttribute("src"))).toEqual([
      "/components/preview?slug=card&variant=Default",
      "/components/preview?slug=card&variant=Compact",
      "/components/preview?slug=card&variant=Wide",
      "/components/preview?slug=card&variant=Empty",
    ]);
  });

  describe("selection", () => {
    it("single mode keeps exactly one iframe and switches it by props, not remount", () => {
      const onChange = vi.fn();
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS}
          selection={{ mode: "single", onChange }}
        />,
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((t) => t.textContent)).toEqual(["Default", "Compact", "Wide", "Empty"]);
      expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual([
        "true",
        "false",
        "false",
        "false",
      ]);
      expect(iframes()).toHaveLength(1);
      const iframe = iframes()[0]!;
      expect(iframe).toHaveAttribute("src", "/components/preview?slug=card&variant=Default");

      fireEvent.click(screen.getByRole("tab", { name: "Wide" }));

      expect(onChange).toHaveBeenCalledWith("Wide");
      expect(iframes()).toHaveLength(1);
      // Same element: the stage was re-propped, not remounted.
      expect(iframes()[0]).toBe(iframe);
      expect(iframe).toHaveAttribute("src", "/components/preview?slug=card&variant=Wide");
      expect(screen.getByRole("tab", { name: "Wide" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toHaveAttribute(
        "aria-labelledby",
        screen.getByRole("tab", { name: "Wide" }).id,
      );
    });

    it("resets the frame's height when the single stage switches variant", () => {
      render(
        <DetailWorkbench slug="card" variants={FOUR_VARIANTS} selection={{ mode: "single" }} />,
      );
      const iframe = iframes()[0]!;
      postFromFrame(iframe, { type: MSG_HEIGHT, v: 1, height: 500, slug: "card", variant: "Default" });
      expect(iframe).toHaveStyle({ height: "500px" });

      fireEvent.click(screen.getByRole("tab", { name: "Compact" }));

      expect(iframe).toHaveStyle({ height: "180px" });
      // The old document's late report no longer matches the stage identity.
      postFromFrame(iframe, { type: MSG_HEIGHT, v: 1, height: 500, slug: "card", variant: "Default" });
      expect(iframe).toHaveStyle({ height: "180px" });
    });

    it("honours a controlled active variant and reports clicks without moving", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS}
          selection={{ mode: "single", active: "Compact", onChange }}
        />,
      );
      const iframe = iframes()[0]!;
      expect(iframe).toHaveAttribute("src", "/components/preview?slug=card&variant=Compact");

      fireEvent.click(screen.getByRole("tab", { name: "Empty" }));

      expect(onChange).toHaveBeenCalledWith("Empty");
      expect(iframe).toHaveAttribute("src", "/components/preview?slug=card&variant=Compact");

      rerender(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS}
          selection={{ mode: "single", active: "Empty", onChange }}
        />,
      );
      expect(iframes()[0]).toBe(iframe);
      expect(iframe).toHaveAttribute("src", "/components/preview?slug=card&variant=Empty");
    });

    it("falls back to the first variant when active names no variant", () => {
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS}
          selection={{ mode: "single", active: "Missing" }}
        />,
      );
      expect(iframes()[0]).toHaveAttribute("src", "/components/preview?slug=card&variant=Default");
      expect(screen.getByRole("tab", { name: "Default" })).toHaveAttribute("aria-selected", "true");
    });

    it("moves between tabs with the arrow keys", () => {
      render(
        <DetailWorkbench slug="card" variants={FOUR_VARIANTS} selection={{ mode: "single" }} />,
      );

      fireEvent.keyDown(screen.getByRole("tab", { name: "Default" }), { key: "ArrowLeft" });

      expect(screen.getByRole("tab", { name: "Empty" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "Empty" })).toHaveAttribute("tabindex", "0");
      expect(iframes()[0]).toHaveAttribute("src", "/components/preview?slug=card&variant=Empty");
    });
  });

  describe("theme", () => {
    it("host mode renders no theme group and never posts sg:setTheme", () => {
      render(
        <DetailWorkbench slug="card" variants={FOUR_VARIANTS} theme={{ mode: "host" }} />,
      );

      expect(screen.queryByRole("group", { name: "Preview theme" })).toBeNull();
      const spies = themeSpies();
      document.documentElement.dataset.theme = "light";

      for (const spy of spies) expect(lastTheme(spy)).toBeUndefined();
    });

    it("toolbar mode (default) still posts the resolved theme on ready", () => {
      render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS} />);
      for (const spy of themeSpies()) {
        expect(lastTheme(spy)).toEqual({ type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "dark" });
      }
    });
  });

  describe("previewParams", () => {
    it("appends URL-encoded params to every frame after slug and variant", () => {
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS.slice(0, 2)}
          previewParams={{ scheme: "dark mode", "x&y": "1=2" }}
        />,
      );

      expect(iframes().map((f) => f.getAttribute("src"))).toEqual([
        "/components/preview?slug=card&variant=Default&scheme=dark%20mode&x%26y=1%3D2",
        "/components/preview?slug=card&variant=Compact&scheme=dark%20mode&x%26y=1%3D2",
      ]);
    });

    it("ignores the reserved slug and variant keys", () => {
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS.slice(0, 1)}
          previewParams={{ slug: "evil", variant: "Other", scheme: "a" }}
        />,
      );

      expect(iframes()[0]).toHaveAttribute(
        "src",
        "/components/preview?slug=card&variant=Default&scheme=a",
      );
    });
  });

  describe("sizing", () => {
    it("fixed mode pins the height and ignores sg:height", () => {
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS.slice(0, 1)}
          sizing={{ mode: "fixed", height: 420 }}
        />,
      );
      const iframe = iframes()[0]!;
      expect(iframe).toHaveStyle({ height: "420px" });

      postFromFrame(iframe, { type: MSG_HEIGHT, v: 1, height: 900, slug: "card", variant: "Default" });

      expect(iframe).toHaveStyle({ height: "420px" });
    });

    it("auto mode (default) follows sg:height", () => {
      render(<DetailWorkbench slug="card" variants={FOUR_VARIANTS.slice(0, 1)} />);
      const iframe = iframes()[0]!;

      postFromFrame(iframe, { type: MSG_HEIGHT, v: 1, height: 900, slug: "card", variant: "Default" });

      expect(iframe).toHaveStyle({ height: "900px" });
    });
  });

  describe("toolbar", () => {
    it("hides the viewport group when viewport is false", () => {
      render(
        <DetailWorkbench slug="card" variants={FOUR_VARIANTS} toolbar={{ viewport: false }} />,
      );
      expect(screen.queryByRole("group", { name: "Preview viewport" })).toBeNull();
      expect(screen.getByRole("group", { name: "Preview layout" })).toBeTruthy();
    });

    it("hides the layout group when layout is false", () => {
      render(
        <DetailWorkbench slug="card" variants={FOUR_VARIANTS} toolbar={{ layout: false }} />,
      );
      expect(screen.queryByRole("group", { name: "Preview layout" })).toBeNull();
      expect(screen.getByRole("group", { name: "Preview viewport" })).toBeTruthy();
    });

    it("renders the code-panel and token-panel pills only when enabled", () => {
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS}
          toolbar={{ codePanel: true, tokenPanel: true }}
        />,
      );
      expect(screen.getByRole("button", { name: /Code panel/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Preview tokens/ })).toBeTruthy();
    });

    it("renders no toolbar box when every group is hidden", () => {
      render(
        <DetailWorkbench
          slug="card"
          variants={FOUR_VARIANTS}
          theme={{ mode: "host" }}
          toolbar={{ viewport: false, layout: false }}
        />,
      );
      expect(document.querySelector(".sg-workbench-toolbar")).toBeNull();
      expect(screen.queryAllByRole("group")).toHaveLength(0);
      expect(iframes()).toHaveLength(4);
    });
  });
});
