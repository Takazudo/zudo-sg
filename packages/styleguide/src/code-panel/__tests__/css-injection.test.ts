// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PREVIEW_ROUTE_PATH } from "../../preview/route.js";
import { injectCssToAllPreviews } from "../css-injection.js";

// Regression test for #48: the code panel's live-CSS injection selects
// preview iframes by matching the preview route URL against `src`. This drives
// the REAL selector (via injectCssToAllPreviews) against an iframe built the
// same way VariantFrame builds its `src` (../preview/variant-frame.tsx), so
// drift between the two fails here instead of silently no-op'ing injection in
// the browser.

/** Mirrors the `src` VariantFrame builds for a given preview URL + slug/variant. */
function variantFrameSrc(previewUrl: string, slug: string, exportName: string): string {
  return `${previewUrl}?slug=${encodeURIComponent(slug)}&variant=${encodeURIComponent(exportName)}`;
}

beforeAll(() => {
  // Prevent happy-dom from actually trying to fetch/navigate the iframe's
  // `src` — these tests only exercise DOM selector matching + contentDocument
  // writes, not real page loads.
  (
    window as unknown as {
      happyDOM: { settings: { navigation: { disableChildFrameNavigation: boolean } } };
    }
  ).happyDOM.settings.navigation.disableChildFrameNavigation = true;
});

afterEach(() => {
  document.body.innerHTML = "";
});

function injectedStyle(iframe: HTMLIFrameElement): Element | null | undefined {
  return iframe.contentDocument?.querySelector('style[data-sg-injected-css="live"]');
}

describe("injectCssToAllPreviews", () => {
  it("injects into an iframe whose src matches VariantFrame's preview route", () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", variantFrameSrc(PREVIEW_ROUTE_PATH, "button", "Variants"));
    document.body.appendChild(iframe);

    injectCssToAllPreviews("live", ".btn { color: red; }");

    expect(injectedStyle(iframe)?.textContent).toBe(".btn { color: red; }");
  });

  it("matches a base-prefixed preview URL passed by the host", () => {
    const previewUrl = `/sg${PREVIEW_ROUTE_PATH}`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", variantFrameSrc(previewUrl, "button", "Variants"));
    document.body.appendChild(iframe);

    injectCssToAllPreviews("live", ".btn { color: blue; }", previewUrl);

    expect(injectedStyle(iframe)?.textContent).toBe(".btn { color: blue; }");
  });

  it("does not inject into an iframe on an unrelated route (regression guard for #48)", () => {
    const iframe = document.createElement("iframe");
    // The pre-#48 standalone route — must NOT match the selector.
    iframe.setAttribute("src", "/preview?slug=button&variant=Variants");
    document.body.appendChild(iframe);

    injectCssToAllPreviews("live", ".btn { color: red; }");

    expect(injectedStyle(iframe)).toBeFalsy();
  });
});
