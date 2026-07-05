import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { withBase } from "@/utils/base";
import { PREVIEW_ROUTE_PATH } from "../../preview/route";
import { injectCssToAllPreviews } from "../css-injection";

// Regression test for #48: the code panel's live-CSS injection selects
// preview iframes by matching PREVIEW_ROUTE_PATH against `src`. This drives
// the REAL selector (via injectCssToAllPreviews) against an iframe built the
// same way VariantFrame builds its `src` (../preview/variant-frame.tsx), so
// drift between the two fails here instead of silently no-op'ing injection in
// the browser.

/** Mirrors the `src` VariantFrame builds for a given slug/variant. */
function variantFrameSrc(slug: string, exportName: string): string {
  const base = withBase(PREVIEW_ROUTE_PATH);
  return `${base}?slug=${encodeURIComponent(slug)}&variant=${encodeURIComponent(exportName)}`;
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

describe("injectCssToAllPreviews", () => {
  it("injects into an iframe whose src matches VariantFrame's preview route", () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", variantFrameSrc("button", "Variants"));
    document.body.appendChild(iframe);

    injectCssToAllPreviews("live", ".btn { color: red; }");

    const style = iframe.contentDocument?.querySelector(
      'style[data-sg-injected-css="live"]',
    );
    expect(style?.textContent).toBe(".btn { color: red; }");
  });

  it("does not inject into an iframe on an unrelated route (regression guard for #48)", () => {
    const iframe = document.createElement("iframe");
    // The pre-#48 standalone route — must NOT match the selector.
    iframe.setAttribute("src", `${withBase("/preview")}?slug=button&variant=Variants`);
    document.body.appendChild(iframe);

    injectCssToAllPreviews("live", ".btn { color: red; }");

    const style = iframe.contentDocument?.querySelector(
      'style[data-sg-injected-css="live"]',
    );
    expect(style).toBeFalsy();
  });
});
