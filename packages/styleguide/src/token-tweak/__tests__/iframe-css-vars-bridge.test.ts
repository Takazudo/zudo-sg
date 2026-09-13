// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRIDGE_SOURCE,
  installIframeReceiver,
  isBridgeMessage,
  onIframeReady,
  sendApplyCssVars,
  sendClearCssVars,
} from "../iframe-css-vars-bridge.js";

describe("isBridgeMessage", () => {
  it("accepts the three well-formed envelopes", () => {
    expect(isBridgeMessage({ source: BRIDGE_SOURCE, type: "ready" })).toBe(true);
    expect(
      isBridgeMessage({ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--a", "1px"]] }),
    ).toBe(true);
    expect(isBridgeMessage({ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [] })).toBe(true);
    expect(isBridgeMessage({ source: BRIDGE_SOURCE, type: "clear-css-vars", names: ["--a"] })).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "apply-css-vars"],
    ["a number", 42],
    ["a foreign source", { source: "other-bridge", type: "ready" }],
    ["a missing source", { type: "ready" }],
    ["a non-string type", { source: BRIDGE_SOURCE, type: 1 }],
    ["an unknown type", { source: BRIDGE_SOURCE, type: "explode" }],
    ["apply without vars", { source: BRIDGE_SOURCE, type: "apply-css-vars" }],
    ["apply with non-array vars", { source: BRIDGE_SOURCE, type: "apply-css-vars", vars: "--a" }],
    ["apply with a one-element pair", { source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--a"]] }],
    ["apply with a non-string value", { source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--a", 1]] }],
    ["clear without names", { source: BRIDGE_SOURCE, type: "clear-css-vars" }],
    ["clear with a non-string name", { source: BRIDGE_SOURCE, type: "clear-css-vars", names: [null] }],
  ])("rejects %s", (_label, value) => {
    expect(isBridgeMessage(value)).toBe(false);
  });
});

function dispatchMessage(data: unknown, origin = window.location.origin, source: unknown = null): void {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: source as Window | null }));
}

describe("installIframeReceiver", () => {
  let teardown: () => void;
  const root = () => document.documentElement;

  beforeEach(() => {
    root().removeAttribute("style");
    teardown = installIframeReceiver(window);
  });

  afterEach(() => teardown());

  it("applies and clears CSS vars on the document root", () => {
    dispatchMessage({ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--color-accent", "red"]] });
    expect(root().style.getPropertyValue("--color-accent")).toBe("red");

    dispatchMessage({ source: BRIDGE_SOURCE, type: "clear-css-vars", names: ["--color-accent"] });
    expect(root().style.getPropertyValue("--color-accent")).toBe("");
  });

  it("ignores cross-origin, foreign and malformed messages", () => {
    dispatchMessage(
      { source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--x", "1"]] },
      "https://evil.example",
    );
    dispatchMessage({ source: "other", type: "apply-css-vars", vars: [["--x", "2"]] });
    expect(() =>
      dispatchMessage({ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: 7 }),
    ).not.toThrow();
    expect(root().style.getPropertyValue("--x")).toBe("");
  });

  it("stops listening after teardown", () => {
    teardown();
    dispatchMessage({ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--y", "3"]] });
    expect(root().style.getPropertyValue("--y")).toBe("");
    teardown = () => {};
  });
});

describe("onIframeReady", () => {
  it("fires only for a same-origin ready envelope from the expected window", () => {
    const expected = {} as Window;
    const callback = vi.fn();
    const off = onIframeReady(expected, callback);

    dispatchMessage({ source: BRIDGE_SOURCE, type: "ready" }, window.location.origin, {});
    dispatchMessage({ source: BRIDGE_SOURCE, type: "ready" }, "https://evil.example", expected);
    dispatchMessage({ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [] }, window.location.origin, expected);
    expect(callback).not.toHaveBeenCalled();

    dispatchMessage({ source: BRIDGE_SOURCE, type: "ready" }, window.location.origin, expected);
    expect(callback).toHaveBeenCalledTimes(1);
    off();
  });
});

describe("senders", () => {
  it("post the envelope to the iframe window, and no-op without one", () => {
    const postMessage = vi.fn();
    const iframe = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;

    sendApplyCssVars(iframe, [["--a", "1"]]);
    sendClearCssVars(iframe, ["--a"]);
    expect(postMessage.mock.calls).toEqual([
      [{ source: BRIDGE_SOURCE, type: "apply-css-vars", vars: [["--a", "1"]] }, window.location.origin],
      [{ source: BRIDGE_SOURCE, type: "clear-css-vars", names: ["--a"] }, window.location.origin],
    ]);

    expect(() => sendApplyCssVars(null, [["--a", "1"]])).not.toThrow();
    expect(() => sendClearCssVars({ contentWindow: null } as HTMLIFrameElement, ["--a"])).not.toThrow();
  });
});
