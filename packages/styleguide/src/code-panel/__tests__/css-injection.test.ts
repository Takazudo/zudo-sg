// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PREVIEW_ROUTE_PATH } from "../../preview/route.js";
import { createPreviewCssOwner, injectCssToAllPreviews, registerCssPreview, replayCssToPreview } from "../css-injection.js";

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

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  injectCssToAllPreviews("live", "");
  injectCssToAllPreviews("live", "", `/sg${PREVIEW_ROUTE_PATH}`);
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

function ownedCss(previewUrl = PREVIEW_ROUTE_PATH) {
  const owner = createPreviewCssOwner(previewUrl);
  cleanups.push(() => owner.dispose());
  return owner;
}
function frame(previewUrl = PREVIEW_ROUTE_PATH) {
  const iframe = document.createElement("iframe");
  iframe.src = variantFrameSrc(previewUrl, "button", "Default");
  document.body.appendChild(iframe);
  return iframe;
}
function registeredFrame(previewUrl = PREVIEW_ROUTE_PATH) {
  const iframe = frame(previewUrl);
  const unregister = registerCssPreview(iframe);
  cleanups.push(unregister);
  return { iframe, unregister };
}

describe("retained owner CSS", () => {
  it("retains input before debounce and replays only after accepted ready", () => {
    const { iframe } = registeredFrame();
    const owner = ownedCss();
    owner.set("live", ".btn { color: red; }");
    owner.apply();
    expect(injectedStyle(iframe)).toBeNull();
    iframe.dispatchEvent(new Event("load"));
    expect(injectedStyle(iframe)).toBeNull();
    owner.set("live", ".btn { color: blue; }");
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)?.textContent).toBe(".btn { color: blue; }");
  });

  it("replays retained CSS into a newly registered iframe without another edit", () => {
    const owner = ownedCss();
    owner.set("live", "button { background: purple; }");
    owner.apply();
    const { iframe } = registeredFrame();
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)?.textContent).toBe("button { background: purple; }");
  });

  it("does not style a replacement document until its accepted ready", () => {
    const { iframe } = registeredFrame();
    const owner = ownedCss();
    owner.set("live", "button { color: red; }");
    replayCssToPreview(iframe);
    const previousDocument = iframe.contentDocument!;
    const replacement = document.implementation.createHTMLDocument("reloaded");
    Object.defineProperty(iframe, "contentDocument", { configurable: true, get: () => replacement });
    owner.set("live", "button { color: green; }");
    owner.apply();
    iframe.dispatchEvent(new Event("load"));
    expect(injectedStyle(iframe)).toBeNull();
    replayCssToPreview(iframe);
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)?.textContent).toBe("button { color: green; }");
    expect(previousDocument.querySelector("style[data-sg-injected-css]")).toBeNull();
    expect(replacement.querySelectorAll("style[data-sg-injected-css]")).toHaveLength(1);
  });

  it("clears retained CSS before a pending apply and never revives it on ready", () => {
    const { iframe } = registeredFrame();
    const owner = ownedCss();
    owner.set("live", "button { color: red; }");
    replayCssToPreview(iframe);
    owner.set("live", "");
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)).toBeNull();
    owner.apply();
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)).toBeNull();
  });

  it("isolates buffers by preview URL and never touches host chrome", () => {
    const first = registeredFrame();
    const second = registeredFrame("/other-frame/");
    const owner = ownedCss();
    owner.set("live", "header { display: none; }");
    replayCssToPreview(first.iframe);
    replayCssToPreview(second.iframe);
    expect(injectedStyle(first.iframe)).toBeTruthy();
    expect(injectedStyle(second.iframe)).toBeNull();
    expect(document.querySelector("style[data-sg-injected-css]")).toBeNull();
  });

  it("owner disposal clears styles and prevents late apply/replay", () => {
    const { iframe } = registeredFrame();
    const owner = ownedCss();
    owner.set("live", "button { color: red; }");
    replayCssToPreview(iframe);
    owner.dispose();
    owner.set("live", "button { color: blue; }");
    owner.apply();
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)).toBeNull();
  });

  it("an older owner cannot clear or reclaim a replacement owner's buffer", () => {
    const { iframe } = registeredFrame();
    const old = ownedCss();
    old.set("live", "button { color: red; }");
    replayCssToPreview(iframe);
    const current = ownedCss();
    current.set("live", "button { color: blue; }");
    current.apply();
    old.set("live", "button { color: green; }");
    old.apply();
    old.dispose();
    replayCssToPreview(iframe);
    expect(injectedStyle(iframe)?.textContent).toBe("button { color: blue; }");
  });

  it("a stale registration cleanup cannot remove a new registration's styles", () => {
    const { iframe, unregister } = registeredFrame();
    const unregisterCurrent = registerCssPreview(iframe);
    cleanups.push(unregisterCurrent);
    const owner = ownedCss();
    owner.set("live", "button { color: red; }");
    replayCssToPreview(iframe);
    unregister();
    expect(injectedStyle(iframe)?.textContent).toBe("button { color: red; }");
    unregisterCurrent();
    expect(injectedStyle(iframe)).toBeNull();
  });

  it("legacy load callbacks replay the latest CSS and are removed on clear", () => {
    const iframe = frame();
    injectCssToAllPreviews("live", "button { color: red; }");
    injectCssToAllPreviews("live", "button { color: blue; }");
    const replacement = document.implementation.createHTMLDocument("legacy reload");
    Object.defineProperty(iframe, "contentDocument", { configurable: true, get: () => replacement });
    iframe.dispatchEvent(new Event("load"));
    expect(injectedStyle(iframe)?.textContent).toBe("button { color: blue; }");
    injectCssToAllPreviews("live", "");
    iframe.dispatchEvent(new Event("load"));
    expect(injectedStyle(iframe)).toBeNull();
  });

  it("owner teardown removes legacy listeners without deleting unrelated author styles", () => {
    const iframe = frame();
    const author = iframe.contentDocument!.createElement("style");
    author.textContent = "body { margin: 0; }";
    iframe.contentDocument!.head.appendChild(author);
    const owner = ownedCss();
    owner.set("live", "button { color: red; }");
    owner.apply();
    owner.dispose();
    iframe.dispatchEvent(new Event("load"));
    expect(injectedStyle(iframe)).toBeNull();
    expect(author.isConnected).toBe(true);
  });
});

describe("exact same-origin preview targeting", () => {
  it("rejects route prefixes, query-spoofed routes and foreign origins", () => {
    const owner = ownedCss("/frame");
    owner.set("live", "button { color: red; }");
    const sources = ["/frame-other", "/other?redirect=/frame", "https://foreign.invalid/frame"];
    for (const source of sources) {
      const iframe = frame(source);
      replayCssToPreview(iframe);
      expect(injectedStyle(iframe) ?? null).toBeNull();
    }
    owner.apply();
    for (const iframe of document.querySelectorAll("iframe")) expect(injectedStyle(iframe) ?? null).toBeNull();
  });

  it("supports relative and non-root routes with variant queries and trailing slashes", () => {
    const owner = ownedCss("./styleguide/frame/");
    owner.set("live", "button { color: blue; }");
    const iframe = frame("/styleguide/frame");
    owner.apply();
    expect(injectedStyle(iframe)?.textContent).toBe("button { color: blue; }");
  });
});
