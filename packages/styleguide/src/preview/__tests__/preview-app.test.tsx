// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { getScope, signal, type Child } from "@takazudo/zfb/zudo-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIsland, fire } from "../../__tests__/helpers/zudo-react.js";
import PreviewApp, { type PreviewAppProps } from "../preview-app.js";
import {
  MSG_HEIGHT,
  MSG_READY,
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
} from "../messages.js";

let observer: ResizeObserverCallback;
const disconnect = vi.fn();
const observe = vi.fn();
let setups: string[];
let cleanups: string[];
let lifecycle: string[];
let bottom: number;
const registry = {
  getStoryBySlug: (slug: string) =>
    slug === "fixture"
      ? {
          variants: ["First", "Second"].map((name) => ({
            exportName: name,
            story: {
              controls: [
                { type: "text", prop: "label", defaultValue: "default" },
              ],
              render(args: Record<string, unknown>): Child {
                // This callback itself uses the story's setup scope.
                const count = signal(0);
                getScope().onActivate(() => {
                  setups.push(name);
                  lifecycle.push(`setup:${name}`);
                  return () => {
                    cleanups.push(name);
                    lifecycle.push(`cleanup:${name}`);
                  };
                });
                return (
                  <button
                    on:click={() => {
                      count.value++;
                    }}
                  >
                    {name}:{String(args.label)}:{count}
                  </button>
                );
              },
            },
          })),
        }
      : undefined,
} as unknown as PreviewAppProps["registry"];
function FixturePreview() {
  return <PreviewApp registry={registry} />;
}
function send(data: unknown, init: MessageEventInit = {}): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: window.location.origin,
      source: window.parent,
      data,
      ...init,
    }),
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  setups = [];
  cleanups = [];
  lifecycle = [];
  bottom = 100.25;
  disconnect.mockClear();
  observe.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observer = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  window.history.replaceState(
    {},
    "",
    "/components/preview?slug=fixture&variant=First",
  );
  vi.spyOn(document.body, "getBoundingClientRect").mockImplementation(
    () => ({ bottom }) as DOMRect,
  );
  vi.spyOn(window, "scrollY", "get").mockReturnValue(24);
});
afterEach(() => {
  delete document.documentElement.dataset.theme;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("PreviewApp", () => {
  it("hydrates, remounts two prop updates and variant changes, and preserves theme-only state", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const app = renderIsland(FixturePreview, {});
    expect(app.html).toContain("First:default:");
    expect(app.container.textContent).toBe("First:default:0");
    expect(setups).toEqual(["First"]);
    fire(app.container.querySelector("button")!, "click");
    await app.flush();
    expect(app.container.textContent).toBe("First:default:1");
    for (const label of ["one", "two"]) {
      send({ type: MSG_UPDATE_PROPS, v: 1, props: { label } });
      await app.flush();
      expect(app.container.textContent).toBe(`First:${label}:0`);
      fire(app.container.querySelector("button")!, "click");
      await app.flush();
    }
    send({ type: MSG_SET_THEME, v: 1, theme: "dark" });
    await app.flush();
    expect(app.container.textContent).toBe("First:two:1");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(setups).toHaveLength(3);
    expect(cleanups).toHaveLength(2);
    window.history.replaceState({}, "", "?slug=fixture&variant=Second");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await app.flush();
    expect(app.container.textContent).toBe("Second:default:0");
    expect(setups).toEqual(["First", "First", "First", "Second"]);
    expect(cleanups).toEqual(["First", "First", "First"]);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([type]) => type === "message")).toHaveLength(
      1,
    );
    expect(vi.getTimerCount()).toBe(2);
    app.dispose();
    expect(cleanups).toEqual(["First", "First", "First", "Second"]);
    expect(lifecycle).toEqual([
      "setup:First",
      "cleanup:First",
      "setup:First",
      "cleanup:First",
      "setup:First",
      "cleanup:First",
      "setup:Second",
      "cleanup:Second",
    ]);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(
      remove.mock.calls.filter(([type]) => type === "message"),
    ).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.documentElement.dataset.sgPreviewHydrated).toBeUndefined();
  });
  it("installs the receiver before ready, reports fractional bottom, shrinks, and recovers late readiness", async () => {
    const post = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation((data) => {
        if (data.type === MSG_READY)
          send({ type: MSG_SET_THEME, theme: "light" });
      });
    const app = renderIsland(FixturePreview, {});
    expect(document.documentElement.dataset.sgPreviewHydrated).toBe("1");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(post).toHaveBeenCalledWith(
      { type: MSG_READY, v: 1, slug: "fixture", variant: "First" },
      window.location.origin,
    );
    expect(post).toHaveBeenCalledWith(
      {
        type: MSG_HEIGHT,
        v: 1,
        slug: "fixture",
        variant: "First",
        height: 125,
      },
      window.location.origin,
    );
    vi.advanceTimersByTime(500);
    bottom = 50.1;
    observer([], {} as ResizeObserver);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: MSG_HEIGHT, height: 75 }),
      window.location.origin,
    );
    post.mockClear();
    send({ type: MSG_REQUEST_READY });
    expect(post.mock.calls.map(([data]) => data.type)).toEqual([
      MSG_READY,
      MSG_HEIGHT,
    ]);
    app.dispose();
    post.mockClear();
    send({ type: MSG_REQUEST_READY });
    expect(post).not.toHaveBeenCalled();
  });
  it.each([
    { origin: "https://untrusted.example" },
    { source: null },
    { data: { type: MSG_UPDATE_PROPS, v: 2, props: { label: "bad" } } },
  ])("rejects untrusted/unsupported envelopes %j", async (change) => {
    const app = renderIsland(FixturePreview, {});
    send({ type: MSG_UPDATE_PROPS, props: { label: "bad" } }, change);
    await app.flush();
    expect(app.container.textContent).toBe("First:default:0");
    send({ type: MSG_UPDATE_PROPS, props: { label: "legacy" } });
    await app.flush();
    expect(app.container.textContent).toBe("First:legacy:0");
  });
  it("shows unknown identities and remounts an actual slug change only once", async () => {
    const app = renderIsland(FixturePreview, {});
    window.history.replaceState({}, "", "?slug=unknown&variant=First");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await app.flush();
    expect(app.container.textContent).toContain(
      "Unknown preview: slug=unknown variant=First",
    );
    expect(cleanups).toEqual(["First"]);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await app.flush();
    expect(cleanups).toHaveLength(1);
  });
});
