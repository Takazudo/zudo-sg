// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderIsland,
  fire,
  getByRole,
  queryAllByRole,
} from "../../__tests__/helpers/zudo-react.js";
import DetailWorkbench, {
  type DetailWorkbenchProps,
} from "../detail-workbench.js";
import { MSG_HEIGHT, MSG_READY, MSG_SET_THEME } from "../messages.js";
import {
  ATTR_CODE_PANEL_HIDDEN,
  LS_CODE_PANEL_HIDDEN,
} from "../../chrome/panel-contract.js";
const variants = ["Default", "Compact", "Wide", "Empty"].map((name) => ({
  exportName: name,
  name,
}));
const defaults = { slug: "card", variants };
function message(frame: HTMLIFrameElement, data: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: location.origin,
      source: frame.contentWindow,
      data,
    }),
  );
}
beforeEach(() => {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.removeAttribute(ATTR_CODE_PANEL_HIDDEN);
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute(ATTR_CODE_PANEL_HIDDEN);
});
describe("DetailWorkbench", () => {
  it("hydrates four frames with one toolbar, keeps local controls and applies viewport/theme/layout to all", async () => {
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      variants: variants.map((v) => ({
        ...v,
        controls: [
          {
            type: "text" as const,
            prop: "label",
            label: "Label",
            defaultValue: "initial",
          },
        ],
      })),
    });
    const frames = [...app.container.querySelectorAll("iframe")];
    expect(frames).toHaveLength(4);
    for (const name of ["Preview theme", "Preview viewport", "Preview layout"])
      expect(queryAllByRole(app.container, "group", { name })).toHaveLength(1);
    expect(app.container.querySelectorAll("input")).toHaveLength(4);
    expect(app.container.textContent).not.toContain("Code panel");
    expect(app.container.textContent).not.toContain("Preview tokens");
    const spies = frames.map((frame) => {
      const spy = vi
        .spyOn(frame.contentWindow!, "postMessage")
        .mockImplementation(() => undefined);
      message(frame, { type: MSG_READY });
      return spy;
    });
    fire(getByRole(app.container, "button", { name: "Desktop" }), "click");
    fire(getByRole(app.container, "button", { name: "Light" }), "click");
    fire(getByRole(app.container, "button", { name: "Grid" }), "click");
    await app.flush();
    for (const frame of frames)
      expect(frame.parentElement!.style.width).toBe("1280px");
    for (const spy of spies)
      expect(spy).toHaveBeenLastCalledWith(
        { type: MSG_SET_THEME, v: 1, theme: "light" },
        location.origin,
      );
    expect(
      app.container
        .querySelector("[data-sg-stage-grid]")!
        .getAttribute("data-sg-stage-grid"),
    ).toBe("grid");
    expect(
      getByRole(app.container, "button", { name: "Grid" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    fire(getByRole(app.container, "button", { name: "Stacked" }), "click");
    await app.flush();
    expect(
      app.container
        .querySelector("[data-sg-stage-grid]")!
        .classList.contains("grid-cols-1"),
    ).toBe(true);
    app.dispose();
  });
  it("single selection switches the existing iframe, resets height and controls and supports keyboard tabs", async () => {
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      selection: { mode: "single" as const },
    });
    const frame = app.container.querySelector("iframe")!;
    message(frame, { type: MSG_READY });
    message(frame, { type: MSG_HEIGHT, height: 600 });
    await app.flush();
    expect(frame.style.height).toBe("600px");
    fire(getByRole(app.container, "tab", { name: "Compact" }), "click");
    await app.flush();
    expect(app.container.querySelectorAll("iframe")).toHaveLength(1);
    expect(app.container.querySelector("iframe")).toBe(frame);
    expect(frame.getAttribute("src")).toBe(
      "/components/preview?slug=card&variant=Compact",
    );
    expect(frame.style.height).toBe("180px");
    expect(frame.title).toBe("card — Compact");
    expect(
      getByRole(app.container, "tab", { name: "Compact" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    fire(getByRole(app.container, "tab", { name: "Compact" }), "keydown", {
      key: "End",
    });
    await app.flush();
    const tab = getByRole(app.container, "tab", { name: "Empty" });
    expect(tab.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(tab);
    expect(
      app.container
        .querySelector('[role="tabpanel"]')!
        .getAttribute("aria-labelledby"),
    ).toBe(tab.id);
    fire(tab, "keydown", { key: "ArrowRight" });
    await app.flush();
    expect(
      getByRole(app.container, "tab", { name: "Default" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
  });
  it("honours controlled selection in-bundle and reports clicks without switching", async () => {
    const change = vi.fn();
    function ControlledWorkbench() {
      return (
        <DetailWorkbench
          {...defaults}
          selection={{
            mode: "single" as const,
            active: "Wide",
            onChange: change,
          }}
        />
      );
    }
    const app = renderIsland(ControlledWorkbench, {});
    fire(getByRole(app.container, "tab", { name: "Default" }), "click");
    await app.flush();
    expect(change).toHaveBeenCalledWith("Default");
    expect(
      app.container.querySelector("iframe")!.getAttribute("src"),
    ).toContain("variant=Wide");
  });
  it("falls back to the first variant and supports an empty variant list", () => {
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      selection: { mode: "single" as const, active: "unknown" },
    });
    expect(
      app.container.querySelector("iframe")!.getAttribute("src"),
    ).toContain("variant=Default");
    app.dispose();
    const empty = renderIsland(DetailWorkbench, {
      slug: "empty",
      variants: [],
      selection: { mode: "single" as const },
    });
    expect(empty.container.querySelector("iframe")).toBeNull();
  });
  it("keeps the code toggle outside the panel, restores persisted visibility and opens the token panel", async () => {
    document.documentElement.setAttribute(ATTR_CODE_PANEL_HIDDEN, "");
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      toolbar: { codePanel: true, tokenPanel: true },
    });
    await app.flush();
    const code = getByRole(app.container, "button", { name: "Code panel" });
    expect(code.getAttribute("aria-pressed")).toBe("false");
    expect(code.closest("#sg-code-panel")).toBeNull();
    fire(code, "click");
    await vi.waitFor(() =>
      expect(code.getAttribute("aria-pressed")).toBe("true"),
    );
    fire(code, "click");
    await vi.waitFor(() =>
      expect(code.getAttribute("aria-pressed")).toBe("false"),
    );
    expect(localStorage.getItem(LS_CODE_PANEL_HIDDEN)).toBe("1");
    const toggle = vi.fn();
    window.addEventListener("toggle-preview-token-panel", toggle);
    fire(
      getByRole(app.container, "button", { name: "Preview tokens" }),
      "click",
    );
    expect(toggle).toHaveBeenCalledTimes(1);
    window.removeEventListener("toggle-preview-token-panel", toggle);
  });
  it("forwards URL, params, permissions and fixed sizing while host mode owns theme", async () => {
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      previewUrl: "/base/preview",
      previewParams: { slug: "bad", variant: "bad", scheme: "dark mode" },
      frameSandbox: ["allow-scripts"],
      frameAllow: ["camera", "microphone"],
      theme: { mode: "host" as const },
      sizing: { mode: "fixed" as const, height: 420 },
    });
    expect(
      queryAllByRole(app.container, "group", { name: "Preview theme" }),
    ).toHaveLength(0);
    for (const [index, frame] of [
      ...app.container.querySelectorAll("iframe"),
    ].entries()) {
      expect(frame.getAttribute("src")).toBe(
        `/base/preview?slug=card&variant=${variants[index]!.exportName}&scheme=dark%20mode`,
      );
      expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
      expect(frame.getAttribute("allow")).toBe("camera; microphone");
      const spy = vi
        .spyOn(frame.contentWindow!, "postMessage")
        .mockImplementation(() => undefined);
      message(frame, { type: MSG_READY });
      message(frame, { type: MSG_HEIGHT, height: 900 });
      await app.flush();
      expect(spy).not.toHaveBeenCalled();
      expect(frame.style.height).toBe("420px");
    }
  });
  it.each(["viewport", "layout"] as const)("hides the %s group", (field) => {
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      toolbar: { [field]: false },
    });
    expect(
      queryAllByRole(app.container, "group", { name: `Preview ${field}` }),
    ).toHaveLength(0);
  });
  it("renders no toolbar when every group is hidden", () => {
    const app = renderIsland(DetailWorkbench, {
      ...defaults,
      theme: { mode: "host" as const },
      toolbar: { viewport: false, layout: false },
    });
    expect(app.container.querySelector(".sg-workbench-toolbar")).toBeNull();
    expect(app.container.querySelectorAll("iframe")).toHaveLength(4);
  });
});
