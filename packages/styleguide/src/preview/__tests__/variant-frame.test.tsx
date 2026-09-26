// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { StoryControl } from "../../stories/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import {
  MSG_HEIGHT,
  MSG_READY,
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
  PROTOCOL_VERSION,
} from "../messages.js";
import VariantFrame, {
  DEFAULT_FRAME_SANDBOX,
  DEFAULT_THEME_MODE,
  DEFAULT_VIEWPORT_ID,
  type ThemeMode,
  type ViewportId,
} from "../variant-frame.js";

/** Dispatch a message as if `iframe`'s document posted it (same origin by default). */
function fromFrame(
  iframe: HTMLIFrameElement,
  data: unknown,
  init: { origin?: string; source?: Window | null } = {},
): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: init.origin ?? window.location.origin,
        source: "source" in init ? init.source : iframe.contentWindow,
        data,
      }),
    );
  });
}

/** A legacy (pre-v1) ready signal: no `v`, no identity. */
function readyFrame(iframe: HTMLIFrameElement): void {
  fromFrame(iframe, { type: MSG_READY });
}

function themeMessages(spy: ReturnType<typeof vi.spyOn>): unknown[] {
  return spy.mock.calls
    .map(([message]: unknown[]) => message)
    .filter(
      (message: unknown) =>
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === MSG_SET_THEME,
    );
}

/** A stage under toolbar control — theme/viewport always arrive as props. */
function Stage(props: {
  slug?: string;
  exportName?: string;
  previewUrl?: string;
  name?: string;
  controls?: StoryControl[];
  themeMode?: ThemeMode;
  viewportId?: ViewportId;
}) {
  return (
    <VariantFrame
      slug={props.slug ?? "cta-button"}
      exportName={props.exportName ?? "Playground"}
      name={props.name ?? "CTA button"}
      controls={props.controls}
      themeMode={props.themeMode ?? DEFAULT_THEME_MODE}
      viewportId={props.viewportId ?? DEFAULT_VIEWPORT_ID}
      previewUrl={props.previewUrl}
    />
  );
}

describe("VariantFrame", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
  });

  it("keeps the exact sandbox token set required by form stories", () => {
    render(<Stage slug="contact-form" exportName="Default" name="Contact form" />);

    const iframe = screen.getByTitle("contact-form — Contact form");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms",
    );
  });

  it("builds the iframe src from the host's base-prefixed preview URL", () => {
    render(
      <VariantFrame
        slug="cta-button"
        exportName="Play ground"
        name="CTA button"
        themeMode={DEFAULT_THEME_MODE}
        viewportId={DEFAULT_VIEWPORT_ID}
        previewUrl="/sg/components/preview"
      />,
    );

    expect(screen.getByTitle("cta-button — CTA button")).toHaveAttribute(
      "src",
      "/sg/components/preview?slug=cta-button&variant=Play%20ground",
    );
  });

  it("defaults the iframe src to the unprefixed preview route", () => {
    render(<Stage />);

    expect(screen.getByTitle("cta-button — CTA button")).toHaveAttribute(
      "src",
      "/components/preview?slug=cta-button&variant=Playground",
    );
  });

  it("carries no global theme or viewport controls of its own", () => {
    render(<Stage />);

    expect(
      screen.queryByRole("group", { name: "Preview theme" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Preview viewport" }),
    ).not.toBeInTheDocument();
  });

  it("renders the toolbar's viewport preset in a focusable non-shrinking scroller", () => {
    const { rerender } = render(<Stage viewportId="full" />);

    const scroller = screen.getByRole("region", {
      name: "Preview viewport canvas",
    });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller.className).toContain("overflow-x-auto");

    const frameWrapper = screen
      .getByTitle("cta-button — CTA button")
      .parentElement;
    expect(frameWrapper?.className).toContain("shrink-0");

    for (const [viewportId, width] of [
      ["mobile", "320px"],
      ["tablet", "768px"],
      ["desktop", "1280px"],
      ["full", "100%"],
    ] as Array<[ViewportId, string]>) {
      rerender(<Stage viewportId={viewportId} />);
      expect(frameWrapper).toHaveStyle({ width });
    }
  });

  it("waits for this frame's readiness before sending the toolbar's theme", () => {
    render(<Stage name="First" />);

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);

    expect(themeMessages(postMessage)).toEqual([]);

    readyFrame(iframe);

    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "dark" },
    ]);
  });

  it("adopts a non-default toolbar theme on its FIRST send, not the default", () => {
    // The late-mount contract in miniature: a stage that mounts while the
    // toolbar already sits on a pinned mode must resolve THAT mode when its
    // frame reports ready — never the catalog default it would have inherited
    // from a broadcast it was not around to hear.
    render(<Stage name="Late" themeMode="light" />);

    const iframe = screen.getByTitle("cta-button — Late") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);

    readyFrame(iframe);

    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "light" },
    ]);
  });

  it("probes the frame after installing its listener to recover a missed ready signal", () => {
    const postMessage = vi.fn();
    const frameWindow = { postMessage } as unknown as Window;
    const contentWindow = vi
      .spyOn(HTMLIFrameElement.prototype, "contentWindow", "get")
      .mockReturnValue(frameWindow);

    const { unmount } = render(<Stage name="First" />);

    expect(postMessage).toHaveBeenCalledWith(
      { type: MSG_REQUEST_READY, v: PROTOCOL_VERSION },
      window.location.origin,
    );

    // Keep the mocked contentWindow in place through effect cleanup so the
    // registry unregisters the same frame identity it registered.
    unmount();
    contentWindow.mockRestore();
  });

  it("pushes a pinned theme and holds it against catalog changes and SPA swaps", async () => {
    const { rerender } = render(<Stage name="First" themeMode="follow" />);

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    readyFrame(iframe);
    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "dark" },
    ]);

    rerender(<Stage name="First" themeMode="light" />);
    expect(themeMessages(postMessage).at(-1)).toEqual({
      type: MSG_SET_THEME,
      v: PROTOCOL_VERSION,
      theme: "light",
    });

    // Pinned: neither a catalog theme flip nor an SPA swap may move it.
    document.documentElement.dataset.theme = "light";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    expect(themeMessages(postMessage)).toHaveLength(2);

    // Back to Follow: resynchronize immediately to the catalog's current value.
    document.documentElement.dataset.theme = "dark";
    rerender(<Stage name="First" themeMode="follow" />);
    expect(themeMessages(postMessage).at(-1)).toEqual({
      type: MSG_SET_THEME,
      v: PROTOCOL_VERSION,
      theme: "dark",
    });
  });

  it("follows catalog theme changes and SPA swaps while on Follow", async () => {
    render(<Stage name="First" themeMode="follow" />);

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    readyFrame(iframe);

    document.documentElement.dataset.theme = "light";
    await waitFor(() => {
      expect(themeMessages(postMessage).at(-1)).toEqual({
        type: MSG_SET_THEME,
        v: PROTOCOL_VERSION,
        theme: "light",
      });
    });

    document.documentElement.dataset.theme = "dark";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await waitFor(() => {
      expect(themeMessages(postMessage).at(-1)).toEqual({
        type: MSG_SET_THEME,
        v: PROTOCOL_VERSION,
        theme: "dark",
      });
    });
  });

  it("isolates simultaneous frames — one frame's readiness never unlocks another", () => {
    render(
      <>
        <Stage name="First" />
        <Stage exportName="Pair" name="Second" />
      </>,
    );

    const first = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const second = screen.getByTitle("cta-button — Second") as HTMLIFrameElement;
    const firstPost = vi
      .spyOn(first.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    const secondPost = vi
      .spyOn(second.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);

    readyFrame(first);
    expect(themeMessages(firstPost)).toEqual([
      { type: MSG_SET_THEME, v: PROTOCOL_VERSION, theme: "dark" },
    ]);
    expect(themeMessages(secondPost)).toEqual([]);
  });

  it("changes theme without resetting live controls or the synced height", () => {
    const controls: StoryControl[] = [
      {
        type: "text",
        prop: "children",
        label: "Label",
        defaultValue: "Browse products",
      },
    ];
    const { rerender } = render(<Stage controls={controls} />);

    const iframe = screen.getByTitle("cta-button — CTA button") as HTMLIFrameElement;
    const input = screen.getByLabelText("Label") as HTMLInputElement;
    readyFrame(iframe);
    fromFrame(iframe, { type: MSG_HEIGHT, height: 246.2 });
    fireEvent.input(input, { target: { value: "Kept value" } });

    rerender(<Stage controls={controls} themeMode="light" />);

    expect(input.value).toBe("Kept value");
    expect(iframe).toHaveStyle({ height: "247px" });
  });
});

describe("VariantFrame protocol v1 (#880)", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
  });

  function frame(name = "CTA button"): HTMLIFrameElement {
    return screen.getByTitle(`cta-button — ${name}`) as HTMLIFrameElement;
  }

  function spyPost(iframe: HTMLIFrameElement) {
    return vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
  }

  it("posts every message to its own origin with v: 1, never to \"*\"", () => {
    const controls: StoryControl[] = [
      { type: "text", prop: "children", label: "Label", defaultValue: "Go" },
    ];
    render(<Stage controls={controls} />);
    const post = spyPost(frame());

    fromFrame(frame(), { type: MSG_READY, v: 1, slug: "cta-button", variant: "Playground" });
    fireEvent.input(screen.getByLabelText("Label"), { target: { value: "Next" } });

    expect(post.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const [message, target] of post.mock.calls) {
      expect(target).toBe(window.location.origin);
      expect((message as { v?: unknown }).v).toBe(PROTOCOL_VERSION);
    }
    expect(post).toHaveBeenCalledWith(
      { type: MSG_UPDATE_PROPS, v: PROTOCOL_VERSION, props: { children: "Next" } },
      window.location.origin,
    );
  });

  it("ignores a cross-origin message even from its own frame", () => {
    render(<Stage />);
    const iframe = frame();
    const post = spyPost(iframe);

    fromFrame(iframe, { type: MSG_READY }, { origin: "https://evil.example" });
    fromFrame(iframe, { type: MSG_HEIGHT, height: 400 }, { origin: "https://evil.example" });

    expect(themeMessages(post)).toEqual([]);
    expect(iframe).toHaveStyle({ height: "180px" });
  });

  it("ignores a same-origin message whose source is another window", () => {
    render(<Stage />);
    const iframe = frame();
    const post = spyPost(iframe);

    fromFrame(iframe, { type: MSG_READY }, { source: window });
    fromFrame(iframe, { type: MSG_HEIGHT, height: 400 }, { source: window });

    expect(themeMessages(post)).toEqual([]);
    expect(iframe).toHaveStyle({ height: "180px" });
  });

  it("ignores a ready or height message carrying a stale identity", () => {
    render(<Stage />);
    const iframe = frame();
    const post = spyPost(iframe);

    fromFrame(iframe, { type: MSG_READY, v: 1, slug: "cta-button", variant: "Old" });
    fromFrame(iframe, { type: MSG_READY, v: 1, slug: "other", variant: "Playground" });
    fromFrame(iframe, { type: MSG_HEIGHT, v: 1, height: 400, slug: "other" });
    fromFrame(iframe, { type: MSG_HEIGHT, v: 1, height: 400, variant: "Old" });

    expect(themeMessages(post)).toEqual([]);
    expect(iframe).toHaveStyle({ height: "180px" });

    fromFrame(iframe, { type: MSG_READY, v: 1, slug: "cta-button", variant: "Playground" });
    fromFrame(iframe, {
      type: MSG_HEIGHT,
      v: 1,
      height: 300,
      slug: "cta-button",
      variant: "Playground",
    });
    expect(themeMessages(post)).toHaveLength(1);
    expect(iframe).toHaveStyle({ height: "300px" });
  });

  it("drops a message with an unsupported protocol version", () => {
    render(<Stage />);
    const iframe = frame();
    const post = spyPost(iframe);

    fromFrame(iframe, { type: MSG_READY, v: 2 });
    fromFrame(iframe, { type: MSG_HEIGHT, v: 2, height: 400 });

    expect(themeMessages(post)).toEqual([]);
    expect(iframe).toHaveStyle({ height: "180px" });
  });

  it("still works with a legacy frame that sends no v and no identity", () => {
    render(<Stage />);
    const iframe = frame();
    const post = spyPost(iframe);

    fromFrame(iframe, { type: MSG_READY });
    fromFrame(iframe, { type: MSG_HEIGHT, height: 321 });

    expect(themeMessages(post)).toHaveLength(1);
    expect(iframe).toHaveStyle({ height: "321px" });
  });

  it.each([
    ["exportName", { exportName: "Pair" }],
    ["slug", { slug: "other-button" }],
    ["previewUrl", { previewUrl: "/sg/components/preview" }],
  ] as const)(
    "resets ready and height when %s changes, without a remount",
    (prop, change) => {
      const { rerender } = render(<Stage />);
      const iframe = document.querySelector("iframe") as HTMLIFrameElement;
      const post = spyPost(iframe);

      readyFrame(iframe);
      fromFrame(iframe, { type: MSG_HEIGHT, height: 400 });
      expect(themeMessages(post)).toHaveLength(1);
      expect(iframe).toHaveStyle({ height: "400px" });

      rerender(<Stage {...change} />);

      // Same element: no keyed remount happened.
      expect(document.querySelector("iframe")).toBe(iframe);
      expect(iframe).toHaveStyle({ height: "180px" });

      // Not ready any more: a theme change waits for the new document.
      rerender(<Stage {...change} themeMode="light" />);
      expect(themeMessages(post)).toHaveLength(1);

      const slug = "slug" in change ? change.slug : "cta-button";
      const variant = "exportName" in change ? change.exportName : "Playground";

      // A late ready from the OLD document names the old identity and is dropped.
      if (prop !== "previewUrl") {
        fromFrame(iframe, { type: MSG_READY, v: 1, slug: "cta-button", variant: "Playground" });
        expect(themeMessages(post)).toHaveLength(1);
      }

      fromFrame(iframe, { type: MSG_READY, v: 1, slug, variant });
      expect(themeMessages(post)).toHaveLength(2);
      expect(themeMessages(post).at(-1)).toEqual({
        type: MSG_SET_THEME,
        v: PROTOCOL_VERSION,
        theme: "light",
      });
    },
  );

  it("renders the default sandbox and no allow attribute by default", () => {
    render(<Stage />);
    const iframe = frame();
    expect(DEFAULT_FRAME_SANDBOX).toEqual(["allow-same-origin", "allow-scripts", "allow-forms"]);
    expect(iframe).toHaveAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
    expect(iframe).not.toHaveAttribute("allow");
  });

  it("renders frameSandbox and frameAllow as given", () => {
    render(
      <VariantFrame
        slug="cta-button"
        exportName="Playground"
        name="CTA button"
        themeMode={DEFAULT_THEME_MODE}
        viewportId={DEFAULT_VIEWPORT_ID}
        frameSandbox={["allow-scripts", "allow-same-origin", "allow-popups"]}
        frameAllow={["clipboard-read", "fullscreen"]}
      />,
    );
    const iframe = frame();
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
    expect(iframe).toHaveAttribute("allow", "clipboard-read; fullscreen");
  });
});
