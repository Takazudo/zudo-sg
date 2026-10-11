import { renderSsr } from "@zudo-sg/demo-ui/src/test-utils/zudo-react.ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TRANSITION_BEFORE_PREPARATION,
  TRANSITION_AFTER_SWAP,
  TRANSITION_NAVIGATION_ABORTED,
} from "@takazudo/zfb-runtime";
import PageLoadingOverlay, { PAGE_LOADING_OVERLAY_ID, PENDING_ATTR } from "../page-loading-overlay";

// A disposable document isolates the module-scope inline-script event listeners.
afterEach(() => vi.useRealTimers());

describe("PageLoadingOverlay bootstrap", () => {
  it("delays visibility, clears pending links after swap/abort, and binds once", () => {
    vi.useFakeTimers();
    const doc = document.implementation.createHTMLDocument("Overlay");
    doc.body.innerHTML = renderSsr(<PageLoadingOverlay />) + '<a href="/company">Company</a>';
    const source = doc.querySelector("a")!;
    const overlay = doc.getElementById(PAGE_LOADING_OVERLAY_ID)!;
    const bootstrap = new Function("document", "globalThis", "Element", doc.querySelector("script")!.textContent!);
    const globals = {};
    const bind = vi.spyOn(doc, "addEventListener");
    bootstrap(doc, globals, Element);
    bootstrap(doc, globals, Element);
    expect(bind).toHaveBeenCalledTimes(3);

    const start = () => {
      const event = new Event(TRANSITION_BEFORE_PREPARATION);
      Object.defineProperty(event, "sourceElement", { value: source });
      doc.dispatchEvent(event);
    };
    start();
    expect(source.hasAttribute(PENDING_ATTR)).toBe(true);
    vi.advanceTimersByTime(149);
    expect(overlay.hasAttribute("data-visible")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(overlay.getAttribute("aria-hidden")).toBe("false");
    doc.dispatchEvent(new Event(TRANSITION_AFTER_SWAP));
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(source.hasAttribute(PENDING_ATTR)).toBe(false);
    start();
    doc.dispatchEvent(new Event(TRANSITION_NAVIGATION_ABORTED));
    vi.advanceTimersByTime(150);
    expect(overlay.hasAttribute("data-visible")).toBe(false);
    expect(source.hasAttribute(PENDING_ATTR)).toBe(false);
  });
});
