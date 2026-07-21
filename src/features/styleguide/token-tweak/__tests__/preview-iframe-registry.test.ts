import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the project-owned iframe-css-vars bridge so we can observe what the
// registry sends to each iframe and drive the `onIframeReady` callback
// manually (the real bridge relies on cross-window postMessage, which is not
// available here).
const applyCalls: Array<{ iframe: unknown; vars: ReadonlyArray<readonly [string, string]> }> = [];
const clearCalls: Array<{ iframe: unknown; names: ReadonlyArray<string> }> = [];
// Per-iframe `ready` callbacks captured from onIframeReady, keyed by contentWindow.
const readyCallbacks = new Map<unknown, () => void>();

vi.mock("../iframe-css-vars-bridge", () => ({
  sendApplyCssVars: (iframe: unknown, vars: ReadonlyArray<readonly [string, string]>) => {
    applyCalls.push({ iframe, vars });
  },
  sendClearCssVars: (iframe: unknown, names: ReadonlyArray<string>) => {
    clearCalls.push({ iframe, names });
  },
  onIframeReady: (expectedSource: unknown, callback: () => void) => {
    readyCallbacks.set(expectedSource, callback);
    return () => readyCallbacks.delete(expectedSource);
  },
}));

type Registry = typeof import("../preview-iframe-registry");

/** A minimal iframe stand-in: only `contentWindow` is read by the registry. */
function makeIframe(id: string): HTMLIFrameElement {
  return { contentWindow: { id } } as unknown as HTMLIFrameElement;
}

/** Fire the captured `ready` callback for an iframe's contentWindow. */
function fireReady(iframe: HTMLIFrameElement): void {
  readyCallbacks.get(iframe.contentWindow)?.();
}

let registry: Registry;

beforeEach(async () => {
  applyCalls.length = 0;
  clearCalls.length = 0;
  readyCallbacks.clear();
  // The registry keeps module-level state (registered set + override map), so
  // re-import a fresh module instance for each test.
  vi.resetModules();
  registry = await import("../preview-iframe-registry");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyPreviewVars", () => {
  it("broadcasts the applied pairs to every registered iframe", () => {
    const a = makeIframe("a");
    const b = makeIframe("b");
    registry.registerPreviewIframe(a);
    registry.registerPreviewIframe(b);
    applyCalls.length = 0;

    registry.applyPreviewVars([["--zd-space", "8px"]]);

    expect(applyCalls).toHaveLength(2);
    expect(applyCalls.map((c) => c.iframe)).toEqual([a, b]);
    for (const call of applyCalls) {
      expect(call.vars).toEqual([["--zd-space", "8px"]]);
    }
  });

  it("upserts: re-applying the same name replays the latest value on ready", () => {
    registry.applyPreviewVars([["--zd-space", "8px"]]);
    registry.applyPreviewVars([["--zd-space", "16px"]]);

    // A late iframe should receive only the latest value, once.
    const late = makeIframe("late");
    registry.registerPreviewIframe(late);
    applyCalls.length = 0;
    fireReady(late);

    expect(applyCalls).toEqual([
      { iframe: late, vars: [["--zd-space", "16px"]] },
    ]);
  });

  it("is a no-op for an empty pair list", () => {
    const a = makeIframe("a");
    registry.registerPreviewIframe(a);
    applyCalls.length = 0;

    registry.applyPreviewVars([]);

    expect(applyCalls).toHaveLength(0);
  });
});

describe("clearPreviewVars", () => {
  it("broadcasts the cleared names to every registered iframe", () => {
    const a = makeIframe("a");
    const b = makeIframe("b");
    registry.registerPreviewIframe(a);
    registry.registerPreviewIframe(b);
    registry.applyPreviewVars([["--zd-space", "8px"]]);

    registry.clearPreviewVars(["--zd-space"]);

    expect(clearCalls).toHaveLength(2);
    expect(clearCalls.map((c) => c.iframe)).toEqual([a, b]);
    for (const call of clearCalls) {
      expect(call.names).toEqual(["--zd-space"]);
    }
  });

  it("deletes from the override map so cleared names are not replayed", () => {
    registry.applyPreviewVars([
      ["--zd-space", "8px"],
      ["--color-accent", "#f00"],
    ]);
    registry.clearPreviewVars(["--zd-space"]);

    const late = makeIframe("late");
    registry.registerPreviewIframe(late);
    applyCalls.length = 0;
    fireReady(late);

    // Only the surviving override is replayed.
    expect(applyCalls).toEqual([
      { iframe: late, vars: [["--color-accent", "#f00"]] },
    ]);
  });

  it("is a no-op for an empty name list", () => {
    const a = makeIframe("a");
    registry.registerPreviewIframe(a);

    registry.clearPreviewVars([]);

    expect(clearCalls).toHaveLength(0);
  });
});

describe("replay on onIframeReady", () => {
  it("replays current overrides to an iframe registered AFTER applyPreviewVars", () => {
    registry.applyPreviewVars([
      ["--zd-space", "8px"],
      ["--color-accent", "#f00"],
    ]);

    const late = makeIframe("late");
    registry.registerPreviewIframe(late);
    applyCalls.length = 0;

    fireReady(late);

    expect(applyCalls).toEqual([
      {
        iframe: late,
        vars: [
          ["--zd-space", "8px"],
          ["--color-accent", "#f00"],
        ],
      },
    ]);
  });

  it("does not replay anything when no overrides are active", () => {
    const fresh = makeIframe("fresh");
    registry.registerPreviewIframe(fresh);
    applyCalls.length = 0;

    fireReady(fresh);

    expect(applyCalls).toHaveLength(0);
  });

  it("stops replaying to an unregistered iframe", () => {
    registry.applyPreviewVars([["--zd-space", "8px"]]);

    const gone = makeIframe("gone");
    registry.registerPreviewIframe(gone);
    registry.unregisterPreviewIframe(gone);
    applyCalls.length = 0;

    // The ready callback's teardown ran on unregister, so firing is a no-op.
    fireReady(gone);

    expect(applyCalls).toHaveLength(0);
  });
});
