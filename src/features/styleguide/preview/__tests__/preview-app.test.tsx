import { h } from "preact";
import { act, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreviewApp from "../preview-app";
import {
  MSG_HEIGHT,
  MSG_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
} from "../messages";

vi.mock("@/styleguide/data/registry", () => ({
  getStoryBySlug: () => ({
    variants: [
      {
        exportName: "Fixture",
        story: {
          controls: [],
          render: () => h("div", { style: { height: "100.25px" } }),
        },
      },
    ],
  }),
}));

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
              data: { type: MSG_SET_THEME, theme: "dark" },
              source: window.parent,
            }),
          );
        }
      });

    render(<PreviewApp />);

    expect(postMessage).toHaveBeenCalledWith({ type: MSG_READY }, "*");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: MSG_SET_THEME, theme: "light" },
          source: null,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: MSG_UPDATE_PROPS, props: { label: "Updated" } },
          source: window.parent,
        }),
      );
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("PreviewApp height reporting", () => {
  it("reports the fractional content bottom and shrinks after content shrinks", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    render(<PreviewApp />);

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
      { type: MSG_HEIGHT, height: 125 },
      "*",
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
      { type: MSG_HEIGHT, height: 85 },
      "*",
    );
  });
});
