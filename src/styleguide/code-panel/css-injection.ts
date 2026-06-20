// Live CSS injection into every preview iframe on the page.
//
// The code panel's CSS buffer feeds this: as the user edits CSS, the text is
// injected (debounced) into a dedicated <style data-sg-injected-css> element
// inside each same-origin preview iframe's <head>, so the preview restyles
// without a reload. Same-origin (the iframes are `/sg/preview` on this origin)
// makes `contentDocument` reachable.

const INJECTED_STYLE_ATTR = "data-sg-injected-css";

function previewIframes(): HTMLIFrameElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLIFrameElement>('iframe[src*="/sg/preview"]'),
  );
}

function injectInto(iframe: HTMLIFrameElement, cssKey: string, css: string): void {
  const doc = iframe.contentDocument;
  if (!doc) return;
  const id = `sg-injected-${cssKey}`;
  let style = doc.querySelector<HTMLStyleElement>(`style[${INJECTED_STYLE_ATTR}="${cssKey}"]`);
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
 * Re-injecting with the same key replaces the prior buffer.
 */
export function injectCssToAllPreviews(cssKey: string, css: string): void {
  for (const iframe of previewIframes()) {
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
