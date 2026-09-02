import { render } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

// `@takazudo/zudo-doc/doclayout`'s real DocLayoutWithDefaults pulls in
// `@takazudo/zfb-runtime`'s ClientRouter, which itself imports the bare
// "react" specifier — a package this project never installs (Preact-only,
// with `react` aliased to `preact/compat` at the Vite level only). That
// alias doesn't reach a node_modules-to-node_modules import (zudo-doc ->
// zfb-runtime), so rendering the real component tree under vitest fails
// with "Cannot find package 'react'" regardless of this seam. The fake
// below stands in for DocLayoutWithDefaults, replicating ONLY the one
// documented behavior this test cares about — the `contentWide` ->
// `data-zd-wide` attribute on `.zd-doc-content-band` — verified against the
// real package source at
// `node_modules/@takazudo/zudo-doc/dist/doclayout/doc-layout.js` (#538).
// This test's job is to prove StyleguideLayout forwards `contentWide` to
// DocLayoutWithDefaults under that exact prop name; `pnpm check` (tsc)
// separately proves the prop type lines up with the real package's
// `DocLayoutProps`.
vi.mock("@takazudo/zudo-doc/doclayout", () => ({
  DocLayoutWithDefaults: (props: { contentWide?: boolean; children?: unknown }) => (
    <div
      class="zd-doc-content-band"
      {...(props.contentWide ? { "data-zd-wide": "" } : {})}
    >
      {props.children}
    </div>
  ),
}));

vi.mock("@takazudo/zfb", () => ({
  Island: ({ children }: { children: unknown }) => children,
}));

vi.mock("@takazudo/zudo-doc/sidebar-tree-island", () => ({
  SidebarTree: () => null,
}));

vi.mock("../header-toggles", () => ({
  default: () => null,
}));

vi.mock("../panel-scripts", () => ({
  PanelStateHeadScript: () => null,
  PanelResizersInitScript: () => null,
}));

import { StyleguideLayout } from "../_styleguide-layout";

function renderTokensLayout(contentWide?: boolean): string {
  return render(
    <StyleguideLayout
      title="Design Tokens"
      activeSlug="tokens"
      head={<></>}
      header={<></>}
      footer={<></>}
      bodyEnd={<></>}
      contentWide={contentWide}
    >
      <p>content</p>
    </StyleguideLayout>,
  );
}

describe("StyleguideLayout contentWide seam (#538)", () => {
  it("forwards contentWide=true through to data-zd-wide on .zd-doc-content-band", () => {
    const html = renderTokensLayout(true);
    expect(html).toMatch(/class="zd-doc-content-band"\s+data-zd-wide/);
  });

  it("omits data-zd-wide from .zd-doc-content-band when contentWide is not passed", () => {
    const html = renderTokensLayout();
    expect(html).toContain("zd-doc-content-band");
    expect(html).not.toContain("data-zd-wide");
  });
});
