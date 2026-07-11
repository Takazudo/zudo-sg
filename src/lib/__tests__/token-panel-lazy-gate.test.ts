/**
 * Contract test for the #206 lazy-import gate.
 *
 * design-token-panel-bootstrap.tsx / preview-token-panel-bootstrap.tsx no
 * longer statically import `@/lib/*-token-panel-bootstrap` (which pulls in
 * the whole @takazudo/zdtp bundle). Instead, at hydration they register a
 * byte-cheap window loader (`__zdtpLazyLoad` / `__zdtpPreviewLazyLoad`) that
 * dynamic-imports the heavy module on demand, behind a module-scoped cached
 * promise.
 *
 * This test drives the REAL component modules (only the dynamic-import
 * target is mocked via `vi.doMock`) to lock in the loader's runtime
 * contract, so a future edit to the gate can't silently regress it:
 *
 *  - a rapid double-call dedupes into ONE in-flight import: the loader
 *    returns the SAME Promise *instance* on both calls. This is not just
 *    "both calls eventually resolve to the same value" — native `import()`
 *    returns a NEW Promise object on every call even for an
 *    already-resolved module specifier, so referential equality only holds
 *    because of the gate's own `loadPromise` cache (confirmed empirically:
 *    without the cache, two back-to-back `import()` calls of the same
 *    mocked specifier return unequal Promise objects here).
 *  - a rejected import resets the cache: the NEXT call gets a fresh Promise
 *    and genuinely re-invokes the dynamic import (not served from a cached
 *    failure), and the failure is swallowed rather than rethrown (no
 *    unhandled rejection reaching the caller).
 *  - the queued pre-hydration click is preserved across a failed import and
 *    only drained once a retry succeeds. The real drain call
 *    (`window.__zdtpReadyClicks` / `__zdtpPreviewReadyClicks`) is fired by
 *    the heavy module itself once it finishes loading — see
 *    `@takazudo/zudo-doc`'s `bootstrapDesignTokenPanel` (calls
 *    `window.__zdtpReadyClicks?.()` at the end) and the top-level
 *    `window.__zdtpPreviewReadyClicks?.()` call in
 *    src/lib/preview-token-panel-bootstrap.ts — never reached if the heavy
 *    module throws before getting there.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface GateHarness {
  /** The bootstrap island component that registers the window loader. */
  componentSpecifier: string;
  /** The heavy module the loader dynamic-imports on demand. */
  libSpecifier: string;
  /** Window key the component registers its loader function under. */
  loaderKey: string;
  /** Window key the heavy module calls once it finishes loading, to drain the queued click. */
  readyClicksKey: string;
  /** Window flag the shim sets when a click is buffered before the loader registers. */
  pendingKey: string;
}

const DOC_PANEL: GateHarness = {
  componentSpecifier: "@/components/design-token-panel-bootstrap",
  libSpecifier: "@/lib/design-token-panel-bootstrap",
  loaderKey: "__zdtpLazyLoad",
  readyClicksKey: "__zdtpReadyClicks",
  pendingKey: "__zdtpPending",
};

const PREVIEW_PANEL: GateHarness = {
  componentSpecifier: "@/components/preview-token-panel-bootstrap",
  libSpecifier: "@/lib/preview-token-panel-bootstrap",
  loaderKey: "__zdtpPreviewLazyLoad",
  readyClicksKey: "__zdtpPreviewReadyClicks",
  pendingKey: "__zdtpPreviewPending",
};

type WindowRecord = Record<string, unknown>;

async function mountAndGetLoader(
  harness: GateHarness,
): Promise<() => Promise<unknown>> {
  const mod = (await import(/* @vite-ignore */ harness.componentSpecifier)) as {
    default: () => void;
  };
  mod.default(); // components are plain functions here — call = "hydrate"
  const loader = (window as unknown as WindowRecord)[harness.loaderKey];
  if (typeof loader !== "function") {
    throw new Error(`${harness.loaderKey} was not registered on window`);
  }
  return loader as () => Promise<unknown>;
}

describe.each([
  ["doc-chrome panel", DOC_PANEL],
  ["preview panel", PREVIEW_PANEL],
])("token panel lazy-load gate (#206 contract) — %s", (_label, harness) => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as unknown as WindowRecord)[harness.loaderKey];
    delete (window as unknown as WindowRecord)[harness.readyClicksKey];
    delete (window as unknown as WindowRecord)[harness.pendingKey];
  });

  afterEach(() => {
    vi.doUnmock(harness.libSpecifier);
    vi.restoreAllMocks();
  });

  it("returns the SAME cached promise on a rapid double-call, resolving to the loaded module", async () => {
    let importCount = 0;
    vi.doMock(harness.libSpecifier, () => {
      importCount += 1;
      return { bootstrapped: true };
    });

    const loader = await mountAndGetLoader(harness);

    const first = loader();
    const second = loader(); // rapid double-call, before the first settles
    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ bootstrapped: true });
    expect(importCount).toBe(1);

    // Calling again after a successful load still reuses the cache — zdtp is
    // downloaded at most once per page, however many times the panel toggles.
    const third = loader();
    expect(third).toBe(first);
    await third;
    expect(importCount).toBe(1);
  });

  it("resets the cache on a rejected import so the next call retries, swallowing the error", async () => {
    let importCount = 0;
    vi.doMock(harness.libSpecifier, () => {
      importCount += 1;
      if (importCount === 1) {
        throw new Error("simulated chunk-load failure");
      }
      return { bootstrapped: true };
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const loader = await mountAndGetLoader(harness);

    const first = loader();
    await expect(first).resolves.toBeUndefined(); // rejection is caught, never rethrown
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(importCount).toBe(1);

    const second = loader();
    expect(second).not.toBe(first); // cache was reset -> a fresh import is attempted
    await expect(second).resolves.toEqual({ bootstrapped: true });
    expect(importCount).toBe(2);
  });

  it("reconciles a click buffered BEFORE the loader registered by kicking the import at hydration (#204)", async () => {
    let importCount = 0;
    vi.doMock(harness.libSpecifier, () => {
      importCount += 1;
      return { bootstrapped: true };
    });
    // A click landed before the island hydrated: the shim set pending but could
    // not call the not-yet-registered loader.
    (window as unknown as WindowRecord)[harness.pendingKey] = true;

    // Hydration must both register the loader AND, seeing the buffered click,
    // fire the import immediately — otherwise the click is dropped until a
    // second one. (Without the reconciliation, importCount stays 0 here.)
    await mountAndGetLoader(harness);
    await vi.waitFor(() => expect(importCount).toBe(1));
  });

  it("does NOT fire the loader at hydration when no click was buffered", async () => {
    let importCount = 0;
    vi.doMock(harness.libSpecifier, () => {
      importCount += 1;
      return { bootstrapped: true };
    });

    // No pending flag: registration must stay byte-cheap — the heavy module is
    // only imported on an actual toggle, not merely because the island hydrated.
    await mountAndGetLoader(harness);
    await Promise.resolve();
    expect(importCount).toBe(0);
  });

  it("does not drain the queued pending click on a failed import, but drains it once a retry succeeds", async () => {
    const readyClicks = vi.fn();
    (window as unknown as WindowRecord)[harness.readyClicksKey] = readyClicks;

    let importCount = 0;
    vi.doMock(harness.libSpecifier, () => {
      importCount += 1;
      if (importCount === 1) {
        throw new Error("simulated chunk-load failure");
      }
      // Mirrors the real heavy module: the ready-clicks drain only fires as
      // a side effect of successfully finishing the load.
      (
        window as unknown as Record<string, (() => void) | undefined>
      )[harness.readyClicksKey]?.();
      return { bootstrapped: true };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const loader = await mountAndGetLoader(harness);

    await loader(); // fails
    expect(readyClicks).not.toHaveBeenCalled(); // queued click stays pending, not dropped

    await loader(); // retries and succeeds
    expect(readyClicks).toHaveBeenCalledTimes(1); // queued click now drained
  });
});
