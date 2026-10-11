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
import { fire, flushAll, getByRole, getByText, queryAllByRole, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { getScope } from "@takazudo/zfb/zudo-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CodePanel, { type CodePanelVariant } from "../code-panel.js";

import { PREVIEW_ROUTE_PATH } from "../../preview/route.js";
import { registerCssPreview, replayCssToPreview } from "../css-injection.js";

const editors = vi.hoisted(() => ({
  activated: vi.fn(),
  disposed: vi.fn(),
  cssChange: undefined as ((css: string) => void) | undefined,
}));
vi.mock("../source-editor.js", () => ({
  default: ({ value, label, onChange }: {
    value: string;
    label?: string;
    onChange?: (css: string) => void;
  }) => {
    getScope().onActivate(() => {
      editors.activated(value);
      if (onChange) editors.cssChange = onChange;
      return () => { editors.disposed(value); };
    });
    return <pre aria-label={label}>{value}</pre>;
  },
}));

const THREE_VARIANTS: CodePanelVariant[] = [
  { exportName: "Default", name: "Default", source: "const a = 1;" },
  { exportName: "Compact", name: "Compact", source: "const b = 2;" },
  { exportName: "Wide", name: "Wide", source: "const c = 3;" },
];

let container: Element;
function renderPanel(variants: CodePanelVariant[]) {
  const island = renderIsland(CodePanel, { storyTitle: "Card", variants, slug: "card" });
  container = island.container;
  return island;
}

describe("CodePanel variant tabs (#900)", async () => {
  it("names the tablist \"Source variant\"", async () => {
    renderPanel(THREE_VARIANTS);
    expect(getByRole(container, "tablist", { name: "Source variant" })).toBeTruthy();
  });

  it("gives only the selected tab tabindex 0", async () => {
    renderPanel(THREE_VARIANTS);
    expect(getByRole(container, "tab", { name: "Default" })).toHaveAttribute("tabindex", "0");
    expect(getByRole(container, "tab", { name: "Compact" })).toHaveAttribute("tabindex", "-1");
    expect(getByRole(container, "tab", { name: "Wide" })).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves selection and focus to the next tab, wrapping at the end", async () => {
    renderPanel(THREE_VARIANTS);

    fire(getByRole(container, "tab", { name: "Default" }), "keydown", { key: "ArrowRight" });
    await flushAll();
    const compact = getByRole(container, "tab", { name: "Compact" });
    expect(compact).toHaveAttribute("aria-selected", "true");
    expect(compact).toHaveAttribute("tabindex", "0");
    expect(document.activeElement).toBe(compact);

    fire(compact, "keydown", { key: "ArrowRight" });
    await flushAll();
    fire(getByRole(container, "tab", { name: "Wide" }), "keydown", { key: "ArrowRight" });
    await flushAll();
    const wrapped = getByRole(container, "tab", { name: "Default" });
    expect(wrapped).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(wrapped);
  });

  it("ArrowLeft moves selection and focus to the previous tab, wrapping at the start", async () => {
    renderPanel(THREE_VARIANTS);

    fire(getByRole(container, "tab", { name: "Default" }), "keydown", { key: "ArrowLeft" });
    await flushAll();
    const wide = getByRole(container, "tab", { name: "Wide" });
    expect(wide).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(wide);
  });

  it("Home selects the first tab and End selects the last", async () => {
    renderPanel(THREE_VARIANTS);

    fire(getByRole(container, "tab", { name: "Default" }), "keydown", { key: "End" });
    await flushAll();
    const wide = getByRole(container, "tab", { name: "Wide" });
    expect(wide).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(wide);

    fire(wide, "keydown", { key: "Home" });
    await flushAll();
    const first = getByRole(container, "tab", { name: "Default" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(first);
  });

  it("wires aria-controls to the tabpanel and aria-labelledby to the active tab", async () => {
    renderPanel(THREE_VARIANTS);

    const defaultTab = getByRole(container, "tab", { name: "Default" });
    const panel = getByRole(container, "tabpanel");
    expect(defaultTab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", defaultTab.id);

    fire(defaultTab, "keydown", { key: "ArrowRight" });
    await flushAll();
    const compactTab = getByRole(container, "tab", { name: "Compact" });
    expect(compactTab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", compactTab.id);
  });

  it("renders no tablist and no tabpanel for a single variant", async () => {
    renderPanel([THREE_VARIANTS[0]!]);
    expect(queryAllByRole(container, "tablist")[0] ?? null).toBeNull();
    expect(queryAllByRole(container, "tabpanel")[0] ?? null).toBeNull();
  });
});

describe("CodePanel editor names + region hooks (#901)", async () => {
  it("renders the stable source and live-CSS region hooks", async () => {
    renderPanel(THREE_VARIANTS);
    expect(
      document.querySelector('.sg-code-source[data-sg-code-region="source"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('.sg-code-live-css[data-sg-code-region="live-css"]'),
    ).toBeTruthy();
  });

  it("renders the source region hook on the tabpanel wrapper when variants > 1", async () => {
    renderPanel(THREE_VARIANTS);
    const region = document.querySelector('[data-sg-code-region="source"]');
    expect(region).toHaveAttribute("role", "tabpanel");
  });

  it("passes the source and Live CSS accessible names to SourceEditor", async () => {
    renderPanel(THREE_VARIANTS);
    expect(
      getByText(container, "const a = 1;").closest("pre"),
    ).toHaveAttribute("aria-label", "Source code for Card: Default");
    expect(
      getByText(container, /Live CSS —/).closest("pre"),
    ).toHaveAttribute("aria-label", "Live CSS for Card");
  });
});


describe("CodePanel keyed source lifecycle", () => {
  it("replaces the source editor and copy text while preserving the panel wrapper", async () => {
    const island = renderPanel(THREE_VARIANTS);
    const panel = getByRole(container, "tabpanel");
    editors.activated.mockClear();
    editors.disposed.mockClear();
    fire(getByRole(container, "tab", { name: "Compact" }), "click");
    await island.flush();
    expect(getByRole(container, "tabpanel")).toBe(panel);
    expect(getByText(container, "const b = 2;")).toBeTruthy();
    expect(container.textContent).not.toContain("const a = 1;");
    expect(editors.disposed).toHaveBeenCalledExactlyOnceWith("const a = 1;");
    expect(editors.activated).toHaveBeenCalledExactlyOnceWith("const b = 2;");
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    fire(getByRole(container, "button", { name: "Copy source" }), "click");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith("const b = 2;"));
    await island.flush();
    writeText.mockRestore();
  });

  it("hydrates deterministic ids when a host omits the slug", () => {
    const island = renderIsland(CodePanel, { storyTitle: "Card example", variants: THREE_VARIANTS });
    expect(getByRole(island.container, "tabpanel").id).toBe("sg-code-panel-Card%20example-panel");
  });
});

afterEach(() => {
  vi.useRealTimers();
  editors.cssChange = undefined;
});

describe("CodePanel live CSS lifecycle", () => {
  function preview() {
    const iframe = document.createElement("iframe");
    iframe.src = `${PREVIEW_ROUTE_PATH}?slug=card&variant=Default`;
    document.body.appendChild(iframe);
    return { iframe, unregister: registerCssPreview(iframe) };
  }
  function css(iframe: HTMLIFrameElement) {
    return iframe.contentDocument?.querySelector('style[data-sg-injected-css="live"]')?.textContent;
  }

  it("retains the newest edit before the debounce, including a clear", () => {
    vi.useFakeTimers();
    const { iframe, unregister } = preview();
    const panel = renderPanel(THREE_VARIANTS);
    try {
      editors.cssChange!("button { color: red; }");
      editors.cssChange!("button { color: blue; }");
      replayCssToPreview(iframe);
      expect(css(iframe)).toBe("button { color: blue; }");
      editors.cssChange!("");
      replayCssToPreview(iframe);
      expect(css(iframe)).toBeUndefined();
      vi.advanceTimersByTime(250);
      expect(css(iframe)).toBeUndefined();
    } finally {
      panel.dispose();
      unregister();
      iframe.remove();
    }
  });

  it("cancels pending application and discards retained edits on panel disposal", () => {
    vi.useFakeTimers();
    const { iframe, unregister } = preview();
    const panel = renderPanel(THREE_VARIANTS);
    try {
      editors.cssChange!("button { color: red; }");
      replayCssToPreview(iframe);
      expect(css(iframe)).toBe("button { color: red; }");
      panel.dispose();
      expect(css(iframe)).toBeUndefined();
      vi.advanceTimersByTime(250);
      replayCssToPreview(iframe);
      expect(css(iframe)).toBeUndefined();
    } finally {
      panel.dispose();
      unregister();
      iframe.remove();
    }
  });
});
