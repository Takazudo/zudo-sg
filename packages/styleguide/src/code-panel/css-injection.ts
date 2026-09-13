// Live CSS injection into every preview iframe on the page.
//
// The code panel's CSS buffer feeds this: as the user edits CSS, the text is
// injected (debounced) into a dedicated <style data-sg-injected-css> element
// inside each same-origin preview iframe's <head>, so the preview restyles
// without a reload. Same-origin (the iframes are PREVIEW_ROUTE_PATH on this
// origin) makes `contentDocument` reachable.
//
// SELECTOR NOTE (#48 fix, #105 hardening): the selector matches the preview
// route URL — the SAME value VariantFrame builds each iframe's `src` from
// (default PREVIEW_ROUTE_PATH, ../preview/route.ts). A shared import keeps the two in
// agreement structurally instead of by comment; __tests__/css-injection.test.ts
// drives the real selector against a VariantFrame-shaped src as a regression
// guard.

import { PREVIEW_ROUTE_PATH } from "../preview/route.js";

const INJECTED_STYLE_ATTR = "data-sg-injected-css";

function previewIframes(previewUrl: string): HTMLIFrameElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLIFrameElement>(`iframe[src*="${previewUrl}"]`),
  );
}

function injectInto(iframe: HTMLIFrameElement, cssKey: string, css: string): void {
  const doc = iframe.contentDocument;
  if (!doc) return;
  const id = `sg-injected-${cssKey}`;
  let style = doc.querySelector<HTMLStyleElement>(
    `style[${INJECTED_STYLE_ATTR}="${CSS.escape(cssKey)}"]`,
  );
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute(INJECTED_STYLE_ATTR, cssKey);
    style.id = id;
    doc.head.appendChild(style);
  }
  style.textContent = css;
}

/**
 * Inject `css` (keyed by `cssKey`, e.g. a filename) into all preview iframes.
 * Re-injecting with the same key replaces the prior buffer. `previewUrl` is the
 * (base-prefixed) preview route the iframes load; defaults to PREVIEW_ROUTE_PATH.
 */
export function injectCssToAllPreviews(
  cssKey: string,
  css: string,
  previewUrl: string = PREVIEW_ROUTE_PATH,
): void {
  for (const iframe of previewIframes(previewUrl)) {
    // Iframe may not have finished loading; retry once on load.
    if (iframe.contentDocument?.head) {
      injectInto(iframe, cssKey, css);
    } else {
      iframe.addEventListener("load", () => injectInto(iframe, cssKey, css), {
        once: true,
      });
    }
  }
}
