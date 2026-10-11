// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { signal, Show } from "@takazudo/zfb/zudo-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderIsland,
  fire,
  getByRole,
} from "../../__tests__/helpers/zudo-react.js";
import type { StoryControl } from "../../stories/index.js";
import VariantFrame from "../variant-frame.js";
import {
  buildPreviewSrc,
  DEFAULT_FRAME_SANDBOX,
  type FrameThemeMode,
  type ViewportId,
} from "../variant-frame-config.js";
import {
  MSG_READY,
  MSG_HEIGHT,
  MSG_SET_THEME,
  MSG_REQUEST_READY,
  MSG_UPDATE_PROPS,
} from "../messages.js";
import {
  applyPreviewVars,
  clearPreviewVars,
} from "../../token-tweak/preview-iframe-registry.js";

const navigation = vi.hoisted(() => ({ listeners: new Set<() => void>() }));
vi.mock("@takazudo/zudo-doc/transitions", () => ({
  onAfterNavigate: (fn: () => void) => {
    navigation.listeners.add(fn);
    return () => navigation.listeners.delete(fn);
  },
}));
function fromFrame(
  frame: HTMLIFrameElement,
  data: unknown,
  init: MessageEventInit = {},
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: location.origin,
      source: frame.contentWindow,
      data,
      ...init,
    }),
  );
}
const defaults = {
  slug: "button",
  exportName: "Default",
  name: "Button",
  themeMode: "follow" as const,
  viewportId: "full" as const,
};
beforeEach(() => {
  document.documentElement.dataset.theme = "dark";
});
afterEach(() => {
  clearPreviewVars(["--e2-test"]);
  vi.restoreAllMocks();
});
describe("VariantFrame", () => {
  it("preserves frame URL, sandbox, permissions and childless shell", () => {
    const app = renderIsland(VariantFrame, {
      ...defaults,
      previewUrl: "/base/components/preview",
      frameAllow: ["camera", "microphone"],
      previewParams: {
        slug: "bad",
        variant: "bad",
        scheme: "dark mode",
        "x&y": "1=2",
      },
    });
    const frame = app.container.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-same-origin allow-scripts allow-forms",
    );
    expect(DEFAULT_FRAME_SANDBOX).toEqual([
      "allow-same-origin",
      "allow-scripts",
      "allow-forms",
    ]);
    expect(frame.getAttribute("allow")).toBe("camera; microphone");
    expect(frame.getAttribute("src")).toBe(
      "/base/components/preview?slug=button&variant=Default&scheme=dark%20mode&x%26y=1%3D2",
    );
    expect(frame.childNodes).toHaveLength(0);
    expect(frame.title).toBe("button — Button");
    expect(frame.style.border).toBe("0px");
    expect(
      app.container.querySelector('[aria-label="Preview theme"]'),
    ).toBeNull();
    const canvas = getByRole(app.container, "region", {
      name: "Preview viewport canvas",
    });
    expect(canvas.getAttribute("tabindex")).toBe("0");
    expect(canvas.classList.contains("overflow-x-auto")).toBe(true);
    expect(canvas.firstElementChild!.classList.contains("shrink-0")).toBe(true);
  });
  it("keeps custom sandbox tokens and omits absent allow", () => {
    const app = renderIsland(VariantFrame, {
      ...defaults,
      frameSandbox: ["allow-scripts"],
    });
    expect(app.container.querySelector("iframe")!.getAttribute("sandbox")).toBe(
      "allow-scripts",
    );
    expect(app.container.querySelector("iframe")!.hasAttribute("allow")).toBe(
      false,
    );
    expect(buildPreviewSrc("/preview", "a b", "x&y")).toBe(
      "/preview?slug=a%20b&variant=x%26y",
    );
  });
  it("probes after binding, gates theme on readiness and targets its own origin", () => {
    let post!: ReturnType<typeof vi.spyOn>;
    const app = renderIsland(VariantFrame, defaults, {
      beforeActivate(test) {
        const frame = test.host.querySelector("iframe")!;
        post = vi
          .spyOn(frame.contentWindow!, "postMessage")
          .mockImplementation((data) => {
            if (data.type === MSG_REQUEST_READY)
              fromFrame(frame, { type: MSG_READY });
          });
      },
    });
    expect(
      post.mock.calls.map(
        (call: unknown[]) => (call[0] as { type: string }).type,
      ),
    ).toEqual([MSG_REQUEST_READY, MSG_SET_THEME]);
    expect(post).toHaveBeenLastCalledWith(
      { type: MSG_SET_THEME, v: 1, theme: "dark" },
      location.origin,
    );
    app.dispose();
  });
  it.each([
    { origin: "https://untrusted.example" },
    { source: null },
    { data: { type: MSG_HEIGHT, height: 600, v: 2 } },
    { data: { type: MSG_HEIGHT, height: 600, slug: "stale" } },
    { data: { type: MSG_HEIGHT, height: 600, variant: "stale" } },
  ])("rejects untrusted, stale or unsupported height %j", async (change) => {
    const app = renderIsland(VariantFrame, defaults);
    const frame = app.container.querySelector("iframe")!;
    fromFrame(frame, { type: MSG_HEIGHT, height: 600 }, change);
    await app.flush();
    expect(frame.style.height).toBe("180px");
    fromFrame(frame, { type: MSG_HEIGHT, height: 100.2 });
    await app.flush();
    expect(frame.style.height).toBe("101px");
    fromFrame(frame, { type: MSG_HEIGHT, height: 10 });
    await app.flush();
    expect(frame.style.height).toBe("80px");
  });
  it("follows theme and two navigation events without doubling registrations, then disposes", async () => {
    const app = renderIsland(VariantFrame, defaults);
    const frame = app.container.querySelector("iframe")!;
    const post = vi
      .spyOn(frame.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    fromFrame(frame, {
      type: MSG_READY,
      slug: "button",
      variant: "Default",
      v: 1,
    });
    document.documentElement.dataset.theme = "light";
    await app.flush();
    await vi.waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(
        { type: MSG_SET_THEME, v: 1, theme: "light" },
        location.origin,
      ),
    );
    expect(navigation.listeners.size).toBe(1);
    post.mockClear();
    for (let i = 0; i < 2; i++) for (const fn of navigation.listeners) fn();
    expect(post).toHaveBeenCalledTimes(2);
    applyPreviewVars([["--e2-test", "red"]]);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "apply-css-vars" }),
      location.origin,
    );
    app.dispose();
    expect(navigation.listeners.size).toBe(0);
    post.mockClear();
    document.documentElement.dataset.theme = "dark";
    await app.flush();
    fromFrame(frame, { type: MSG_READY });
    applyPreviewVars([["--e2-test", "blue"]]);
    expect(post).not.toHaveBeenCalled();
  });
  it("reacts to toolbar state without resetting controls or height and resets a new document", async () => {
    const mode = signal<FrameThemeMode>("follow");
    const viewport = signal<ViewportId>("full");
    const variant = signal("Default");
    function ReactiveStage() {
      return (
        <VariantFrame
          {...defaults}
          exportName={variant}
          themeMode={mode}
          viewportId={viewport}
          controls={[
            {
              type: "text",
              prop: "label",
              label: "Label",
              defaultValue: "initial",
            },
          ]}
        />
      );
    }
    const app = renderIsland(ReactiveStage, {});
    const frame = app.container.querySelector("iframe")!;
    const post = vi
      .spyOn(frame.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    fromFrame(frame, { type: MSG_READY });
    fromFrame(frame, { type: MSG_HEIGHT, height: 500 });
    await app.flush();
    const input = app.container.querySelector(
      'input[type="text"]',
    )! as HTMLInputElement;
    input.value = "edited";
    fire(input, "input");
    await app.flush();
    expect(post).toHaveBeenLastCalledWith(
      { type: MSG_UPDATE_PROPS, v: 1, props: { label: "edited" } },
      location.origin,
    );
    mode.value = "light";
    viewport.value = "desktop";
    await app.flush();
    expect(frame.style.height).toBe("500px");
    expect(input.value).toBe("edited");
    expect(frame.parentElement!.style.width).toBe("1280px");
    expect(post).toHaveBeenLastCalledWith(
      { type: MSG_SET_THEME, v: 1, theme: "light" },
      location.origin,
    );
    variant.value = "Other";
    await app.flush();
    expect(app.container.querySelector("iframe")).toBe(frame);
    expect(frame.style.height).toBe("180px");
    expect(
      (app.container.querySelector('input[type="text"]') as HTMLInputElement)
        .value,
    ).toBe("initial");
    post.mockClear();
    mode.value = "dark";
    await app.flush();
    expect(post).not.toHaveBeenCalled();
    fromFrame(frame, { type: MSG_READY, variant: "Default" });
    expect(post).not.toHaveBeenCalled();
    fromFrame(frame, { type: MSG_READY, variant: "Other" });
    expect(post).toHaveBeenLastCalledWith(
      { type: MSG_SET_THEME, v: 1, theme: "dark" },
      location.origin,
    );
  });
  it.each(["light", "none"] as const)(
    "holds %s mode against catalog changes",
    async (themeMode) => {
      const app = renderIsland(VariantFrame, {
        ...defaults,
        themeMode,
        fixedHeight: 420,
      });
      const frame = app.container.querySelector("iframe")!;
      const post = vi
        .spyOn(frame.contentWindow!, "postMessage")
        .mockImplementation(() => undefined);
      fromFrame(frame, { type: MSG_READY });
      expect(post).toHaveBeenCalledTimes(themeMode === "none" ? 0 : 1);
      post.mockClear();
      document.documentElement.dataset.theme = "light";
      for (const fn of navigation.listeners) fn();
      fromFrame(frame, { type: MSG_HEIGHT, height: 900 });
      await app.flush();
      expect(post).not.toHaveBeenCalled();
      expect(frame.style.height).toBe("420px");
    },
  );
  it("adopts current toolbar values when mounted after they change", async () => {
    const visible = signal(false);
    const mode = signal<FrameThemeMode>("follow");
    const viewport = signal<ViewportId>("full");
    function LateStage() {
      return (
        <Show when={visible}>
          {() => (
            <VariantFrame
              {...defaults}
              themeMode={mode}
              viewportId={viewport}
            />
          )}
        </Show>
      );
    }
    const app = renderIsland(LateStage, {});
    mode.value = "light";
    viewport.value = "mobile";
    visible.value = true;
    await app.flush();
    const frame = app.container.querySelector("iframe")!;
    expect(frame.parentElement!.style.width).toBe("320px");
    const post = vi
      .spyOn(frame.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    fromFrame(frame, { type: MSG_READY });
    expect(post).toHaveBeenLastCalledWith(
      { type: MSG_SET_THEME, v: 1, theme: "light" },
      location.origin,
    );
  });
  it("updates each control type, clamps numbers, resets defaults and collapses controls", async () => {
    const app = renderIsland(VariantFrame, {
      ...defaults,
      controls: [
        {
          type: "text",
          prop: "label",
          label: "Label",
          defaultValue: "initial",
        },
        {
          type: "select",
          prop: "size",
          label: "Size",
          options: ["small", "large"],
          defaultValue: "small",
        },
        {
          type: "boolean",
          prop: "enabled",
          label: "Enabled",
          defaultValue: false,
        },
        {
          type: "number",
          prop: "count",
          label: "Count",
          defaultValue: 2,
          min: 1,
          max: 5,
          ui: "input",
        },
        {
          type: "number",
          prop: "range",
          label: "Range",
          defaultValue: 2,
          min: 1,
          max: 5,
        },
        {
          type: "color",
          prop: "color",
          label: "Color",
          defaultValue: "#112233",
        },
      ] satisfies StoryControl[],
    });
    const frame = app.container.querySelector("iframe")!;
    const post = vi
      .spyOn(frame.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    const select = app.container.querySelector("select")!;
    select.value = "large";
    fire(select, "change");
    const checkbox =
      app.container.querySelector<HTMLInputElement>('[type="checkbox"]')!;
    checkbox.checked = true;
    fire(checkbox, "change");
    for (const [type, value] of [
      ["text", "edited"],
      ["number", "20"],
      ["range", "4"],
      ["color", "#ffffff"],
    ]) {
      const input = app.container.querySelector<HTMLInputElement>(
        `[type="${type}"]`,
      )!;
      input.value = value!;
      fire(input, "input");
      await app.flush();
    }
    expect(post).toHaveBeenLastCalledWith(
      {
        type: MSG_UPDATE_PROPS,
        v: 1,
        props: {
          label: "edited",
          size: "large",
          enabled: true,
          count: 5,
          range: 4,
          color: "#ffffff",
        },
      },
      location.origin,
    );
    expect(
      app.container.querySelector<HTMLInputElement>('[type="number"]')!.value,
    ).toBe("5");
    fire(getByRole(app.container, "button", { name: /Controls/ }), "click");
    await app.flush();
    fire(getByRole(app.container, "button", { name: /Controls/ }), "click");
    await app.flush();
    expect(
      app.container.querySelector<HTMLInputElement>('[type="number"]')!.value,
    ).toBe("5");
    fire(getByRole(app.container, "button", { name: "Reset" }), "click");
    await app.flush();
    expect(app.container.querySelector("select")!.value).toBe("small");
    expect(
      app.container.querySelector<HTMLInputElement>('[type="checkbox"]')!
        .checked,
    ).toBe(false);
    expect(
      app.container.querySelector<HTMLInputElement>('[type="color"]')!.value,
    ).toBe("#112233");
    expect(
      app.container.querySelector<HTMLInputElement>('[type="number"]')!.value,
    ).toBe("2");
    fire(getByRole(app.container, "button", { name: /Controls/ }), "click");
    await app.flush();
    expect(app.container.querySelector("input")).toBeNull();
    fire(getByRole(app.container, "button", { name: /Controls/ }), "click");
    await app.flush();
    expect(
      app.container.querySelector<HTMLInputElement>('[type="number"]')!.value,
    ).toBe("2");
  });
  it("isolates readiness between simultaneous frames", () => {
    function TwoFrames() {
      return (
        <div>
          <VariantFrame {...defaults} />
          <VariantFrame {...defaults} exportName="Other" />
        </div>
      );
    }
    const app = renderIsland(TwoFrames, {});
    const frames = app.container.querySelectorAll("iframe");
    const one = vi
      .spyOn(frames[0]!.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    const two = vi
      .spyOn(frames[1]!.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    fromFrame(frames[0]!, { type: MSG_READY });
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();
  });
});
