// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { h } from "preact";
import { act, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreviewApp, { type PreviewAppProps } from "../preview-app.js";
import {
  MSG_HEIGHT,
  MSG_READY,
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
  PROTOCOL_VERSION,
} from "../messages.js";

const IDENTITY = { slug: "fixture", variant: "Fixture" } as const;
const READY = { type: MSG_READY, v: PROTOCOL_VERSION, ...IDENTITY };
const height = (value: number) => ({
  type: MSG_HEIGHT,
  v: PROTOCOL_VERSION,
  height: value,
  ...IDENTITY,
});

// PreviewApp receives the registry as a prop (never island props — see the
// component header); a structural fixture stands in for createRegistry().
const registry = {
  getStoryBySlug: () =>
    ({
      variants: [
        {
          exportName: "Fixture",
          story: {
            controls: [],
            render: () => h("div", { style: { height: "100.25px" } }),
          },
        },
      ],
    }) as unknown as ReturnType<PreviewAppProps["registry"]["getStoryBySlug"]>,
};

const FRACTIONAL_FIXTURE_CONTENT_BOTTOM = 100.25;
const FRACTIONAL_FIXTURE_SCROLL_Y = 24;
const FRACTIONAL_FIXTURE_DOCUMENT_BOTTOM =
  FRACTIONAL_FIXTURE_CONTENT_BOTTOM + FRACTIONAL_FIXTURE_SCROLL_Y;
const FRACTIONAL_FIXTURE_SCROLL_HEIGHT = 124;

let bodyBottom = FRACTIONAL_FIXTURE_CONTENT_BOTTOM;
let resizeCallback: ResizeObserverCallback | undefined;

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  observe = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.useFakeTimers();
  bodyBottom = FRACTIONAL_FIXTURE_CONTENT_BOTTOM;
  resizeCallback = undefined;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  window.history.replaceState(
    {},
    "",
    "/components/preview?slug=fixture&variant=Fixture",
  );

  vi.spyOn(document.body, "getBoundingClientRect").mockImplementation(
    () => ({ bottom: bodyBottom }) as DOMRect,
  );
  Object.defineProperty(document.body, "scrollHeight", {
    configurable: true,
    value: FRACTIONAL_FIXTURE_SCROLL_HEIGHT,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: FRACTIONAL_FIXTURE_SCROLL_Y,
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-sg-preview-hydrated");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PreviewApp parent messaging", () => {
  it("installs its listener before signaling readiness and preserves theme across prop updates", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation((message) => {
        if (
          typeof message === "object" &&
          message !== null &&
          (message as { type?: unknown }).type === MSG_READY
        ) {
          // Model the parent's immediate response to readiness. Because
          // postMessage is mocked synchronously, this reaches the frame only
          // if its listener was installed before the handshake was sent.
          window.dispatchEvent(
            new MessageEvent("message", {
              origin: window.location.origin,
              data: { type: MSG_SET_THEME, theme: "dark" },
              source: window.parent,
            }),
          );
        }
      });

    render(<PreviewApp registry={registry} />);

    expect(postMessage).toHaveBeenCalledWith(READY, window.location.origin);
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: MSG_SET_THEME, theme: "light" },
          source: null,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: MSG_UPDATE_PROPS, props: { label: "Updated" } },
          source: window.parent,
        }),
      );
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("replies to a readiness probe after its one-shot ready signal", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    render(<PreviewApp registry={registry} />);
    expect(postMessage).toHaveBeenCalledWith(READY, window.location.origin);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: MSG_REQUEST_READY },
          source: window.parent,
        }),
      );
    });

    const readyMessages = postMessage.mock.calls.filter(
      ([message]) =>
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === MSG_READY,
    );
    expect(readyMessages).toHaveLength(2);
  });

  it("re-reports height alongside readiness, so a listener that attaches after every mount/timer/resize report has already fired can still recover it (#537)", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    render(<PreviewApp registry={registry} />);

    // Drop every call recorded during mount (the ready signal plus the
    // immediate/100ms/500ms height reports) so the assertions below can only
    // pass if the probe response below re-posts both on its own.
    postMessage.mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: { type: MSG_REQUEST_READY },
          source: window.parent,
        }),
      );
    });

    expect(postMessage).toHaveBeenCalledWith(READY, window.location.origin);
    expect(postMessage).toHaveBeenCalledWith(
      height(125),
      window.location.origin,
    );
  });
});

describe("PreviewApp height reporting", () => {
  it("reports the fractional content bottom and shrinks after content shrinks", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    render(<PreviewApp registry={registry} />);

    const heightMessageCount = (): number =>
      postMessage.mock.calls.filter(
        ([message]) =>
          typeof message === "object" &&
          message !== null &&
          (message as { type?: unknown }).type === MSG_HEIGHT,
      ).length;

    const fixtureRoot = document.querySelector("[data-sg-variant-root]");
    const fixtureContent = fixtureRoot?.firstElementChild as HTMLElement | null;
    expect(fixtureContent?.style.height).toBe("100.25px");
    if (!fixtureContent) throw new Error("fixture content did not render");

    // The locked #500 fixture distinguishes the rounded scrollHeight (124)
    // from the document-coordinate content bottom (100.25 + 24 = 124.25),
    // which must be rounded up to 125.
    expect(document.body.scrollHeight).toBe(FRACTIONAL_FIXTURE_SCROLL_HEIGHT);
    expect(
      document.body.getBoundingClientRect().bottom + window.scrollY,
    ).toBe(FRACTIONAL_FIXTURE_DOCUMENT_BOTTOM);
    expect(postMessage).toHaveBeenCalledWith(
      height(125),
      window.location.origin,
    );

    // Preserve the reporter's immediate, 100ms, and 500ms calls.
    expect(heightMessageCount()).toBe(1);
    vi.advanceTimersByTime(100);
    expect(heightMessageCount()).toBe(2);
    vi.advanceTimersByTime(400);
    expect(heightMessageCount()).toBe(3);

    // A fresh measurement on resize must be allowed to shrink; no max-height
    // accumulator may make the frame ratchet taller.
    fixtureContent.style.height = "60.25px";
    bodyBottom = 60.25;
    resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);

    expect(postMessage).toHaveBeenLastCalledWith(
      height(85),
      window.location.origin,
    );
  });
});

describe("PreviewApp hydration marker", () => {
  it("sets html[data-sg-preview-hydrated=\"1\"] once mounted", () => {
    expect(document.documentElement.hasAttribute("data-sg-preview-hydrated")).toBe(false);
    render(<PreviewApp registry={registry} />);
    expect(document.documentElement.getAttribute("data-sg-preview-hydrated")).toBe("1");
  });
});

describe("PreviewApp protocol v1 (#880)", () => {
  function send(data: unknown, init: { origin?: string; source?: Window | null } = {}): void {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: init.origin ?? window.location.origin,
          source: "source" in init ? init.source : window.parent,
          data,
        }),
      );
    });
  }

  it("announces sg:ready with v and the frame's identity from location.search", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    render(<PreviewApp registry={registry} />);

    expect(postMessage).toHaveBeenCalledWith(
      { type: MSG_READY, v: 1, slug: "fixture", variant: "Fixture" },
      window.location.origin,
    );
    for (const [message, target] of postMessage.mock.calls) {
      expect(target).toBe(window.location.origin);
      expect((message as { v?: unknown }).v).toBe(PROTOCOL_VERSION);
    }
  });

  it("ignores a cross-origin message even when its source is the parent", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    render(<PreviewApp registry={registry} />);

    send({ type: MSG_SET_THEME, theme: "dark" }, { origin: "https://evil.example" });
    expect(document.documentElement.dataset.theme).toBeUndefined();

    send({ type: MSG_SET_THEME, theme: "dark" });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignores a same-origin message whose source is not the parent", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    render(<PreviewApp registry={registry} />);

    send({ type: MSG_SET_THEME, theme: "dark" }, { source: null });
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("accepts a legacy parent message without v and rejects v: 2", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    render(<PreviewApp registry={registry} />);

    send({ type: MSG_SET_THEME, v: 2, theme: "light" });
    expect(document.documentElement.dataset.theme).toBeUndefined();

    send({ type: MSG_SET_THEME, theme: "light" });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
