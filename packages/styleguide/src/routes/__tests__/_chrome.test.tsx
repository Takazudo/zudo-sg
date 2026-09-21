// @vitest-environment happy-dom
//
// Regression guard for #815(a): the engine-route marker must live in a region
// the client router SWAPS on navigation, not one it lifts whole across a swap
// via `data-zfb-transition-persist` (the framework `<header>` — see
// @takazudo/zudo-doc's header.js). `chromeProps()` returns `header` and
// `bodyEnd` as separate slots consumed by `_styleguide-layout.tsx`, so the
// marker's placement is provable at this level without rendering the full
// DocLayout + ClientRouter persist machinery (that proof is #816's e2e
// crawl).
//
// Every dependency below crosses a package boundary this test stubs rather
// than exercises — same seam pattern as
// `../../chrome/__tests__/_styleguide-layout.test.tsx` (#538).
import type { ComponentChildren, VNode } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

vi.mock("virtual:zudo-doc-route-context", () => ({ routeContext: {} }));
vi.mock("virtual:zudo-doc-chrome-bindings", () => ({ chromeBindings: {} }));

vi.mock("@takazudo/zudo-doc/route-context", () => ({
  createRouteContext: () => ({
    settings: { sidebarToggle: true, dynamicPageTransition: false, noindex: false },
    defaultLocale: "en",
  }),
}));

vi.mock("@takazudo/zudo-doc/chrome", () => ({
  createChrome: () => ({
    composeMetaTitle: (title: string) => `${title} | Test Site`,
    HeadWithDefaults: () => <></>,
    HeaderWithDefaults: () => <header data-header="">framework header</header>,
    FooterWithDefaults: () => <footer data-footer="">framework footer</footer>,
    BodyEndIslands: () => <div data-body-end-islands="" />,
  }),
}));

vi.mock("../../registry/index.js", () => ({
  buildNavNodes: () => [],
}));

vi.mock("../_registry.js", () => ({ registry: {} }));

vi.mock("../_context.js", () => ({
  ctx: { base: "" },
  withBase: (path: string) => path,
}));

// `chromeProps()`'s `header`/`bodyEnd` are typed as the broader
// `ComponentChildren` (via `StyleguideLayoutProps`), but both mocks above
// always return a real element — narrow for `render`'s `VNode` parameter.
function renderSlot(node: ComponentChildren): string {
  return render(node as VNode);
}

describe("chromeProps engine-route marker (#815)", () => {
  it("emits data-sg-engine-route inside bodyEnd, not header", async () => {
    const { chromeProps } = await import("../_chrome.js");
    const props = chromeProps({ pageTitle: "Components", path: "/components" });

    const bodyEndHtml = renderSlot(props.bodyEnd);
    expect(bodyEndHtml).toContain("data-sg-engine-route");

    const headerHtml = renderSlot(props.header);
    expect(headerHtml).not.toContain("data-sg-engine-route");
  });

  it("keeps the marker hidden and attribute-only (no visible chrome added)", async () => {
    const { chromeProps } = await import("../_chrome.js");
    const props = chromeProps({ pageTitle: "Tokens", path: "/tokens" });

    const bodyEndHtml = renderSlot(props.bodyEnd);
    expect(bodyEndHtml).toMatch(/<div hidden data-sg-engine-route="true"><\/div>/);
  });
});
