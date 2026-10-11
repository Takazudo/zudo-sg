// @vitest-environment happy-dom
import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { describe, expect, it, vi } from "vitest";
import type { NavNode } from "../../registry/nav-nodes.js";

// Keep this forwarding test focused on the documented zudo-doc layout slots.
vi.mock("@takazudo/zudo-doc/doclayout", () => ({
  DocLayoutWithDefaults: (props: {
    contentWide?: boolean;
    head?: Child;
    headerOverride?: Child;
    sidebarOverride?: Child;
    afterSidebar?: Child;
    children?: Child;
  }) => (
    <html>
      <head>{props.head}</head>
      <body>
        {props.headerOverride}
        <aside>{props.sidebarOverride}</aside>
        {props.afterSidebar}
        <div
          class="zd-doc-content-band"
          {...(props.contentWide ? { "data-zd-wide": "" } : {})}
        >
          {props.children}
        </div>
      </body>
    </html>
  ),
}));

vi.mock("@takazudo/zfb", () => ({
  Island: ({ children }: { children: unknown }) => children,
}));

vi.mock("@takazudo/zudo-doc/sidebar-tree-island", () => ({
  SidebarTree: () => null,
}));

// The prepaint factories import zfb internally too, so they need the same
// package-boundary seam as DocLayoutWithDefaults. Sentinels expose the props
// the host forwards; the package owns the script bytes and island behavior.
vi.mock("@takazudo/zudo-doc/sidebar-prepaint", () => ({
  createSidebarPrepaint: vi.fn(() => ({ hideSidebar }: { hideSidebar?: boolean }) => (
    <div data-sidebar-toggle-slot="" data-hide-sidebar={String(hideSidebar)} />
  )),
  createSidebarVisibilityPrepaint: vi.fn(() => ({ hideSidebar }: { hideSidebar?: boolean }) => (
    <script data-sidebar-visibility-slot="" data-hide-sidebar={String(hideSidebar)} />
  )),
}));

vi.mock("../panel-scripts", () => ({
  PanelStateHeadScript: () => null,
  PanelResizersInitScript: () => null,
}));

import { StyleguideLayout } from "../_styleguide-layout";
import {
  createSidebarPrepaint,
  createSidebarVisibilityPrepaint,
} from "@takazudo/zudo-doc/sidebar-prepaint";

const NAV_NODES: NavNode[] = [];
const SIDEBAR_TOGGLE = true;

function renderTokensLayout(
  contentWide?: boolean,
  header: JSX.Element = <></>,
): string {
  return render(
    <StyleguideLayout
      title="Design Tokens"
      activeSlug="tokens"
      lang="en"
      head={<></>}
      header={header}
      footer={<></>}
      bodyEnd={<></>}
      contentWide={contentWide}
      navNodes={NAV_NODES}
      sidebarToggle={SIDEBAR_TOGGLE}
      enableClientRouter
      noindex={false}
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

describe("StyleguideLayout header slot (#541)", () => {
  // The shell used to wrap the page header in `.sg-header-region` and overlay
  // an `.sg-header-toggles` island onto the framework header band. Both are
  // gone; the styleguide-only controls moved into the detail page's own
  // workbench toolbar. This pins the shell to passing the header through
  // verbatim, because re-introducing the overlay would put the code-panel
  // toggle back on every route — including the one place it must never be, a
  // panel that hides itself.
  it("passes the page header through with no styleguide chrome around it", () => {
    const html = renderTokensLayout(
      true,
      <header data-header="">framework chrome</header>,
    );

    expect(html).toContain("<header data-header=\"\">framework chrome</header>");
    expect(html).not.toContain("sg-header-region");
    expect(html).not.toContain("sg-header-toggles");
  });
});

describe("StyleguideLayout sidebar toggle slots (#622)", () => {
  it("binds both package factories to the sidebarToggle prop", () => {
    renderTokensLayout();
    for (const factory of [createSidebarPrepaint, createSidebarVisibilityPrepaint]) {
      expect(factory).toHaveBeenCalledWith({ sidebarToggle: SIDEBAR_TOGGLE });
    }
  });

  it("places visibility prepaint in the head and the toggle after the sidebar", () => {
    const document = new DOMParser().parseFromString(renderTokensLayout(), "text/html");
    const visibility = document.querySelector("[data-sidebar-visibility-slot]");
    const toggle = document.querySelector("[data-sidebar-toggle-slot]");

    expect(document.querySelectorAll("[data-sidebar-visibility-slot]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-sidebar-toggle-slot]")).toHaveLength(1);
    expect(visibility?.parentElement).toBe(document.head);
    expect(visibility?.getAttribute("data-hide-sidebar")).toBe("false");
    expect(toggle?.previousElementSibling?.tagName).toBe("ASIDE");
    expect(toggle?.getAttribute("data-hide-sidebar")).toBe("false");
  });

  it("forwards hideSidebar to both package gates on standalone token pages", () => {
    const html = render(
      <StyleguideLayout
        title="Design Tokens"
        hideSidebar
        lang="en"
        head={<></>}
        header={<></>}
        footer={<></>}
        bodyEnd={<></>}
        navNodes={NAV_NODES}
        sidebarToggle={SIDEBAR_TOGGLE}
        enableClientRouter
        noindex={false}
      >
        <p>tokens</p>
      </StyleguideLayout>,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    for (const selector of ["[data-sidebar-visibility-slot]", "[data-sidebar-toggle-slot]"]) {
      expect(document.querySelector(selector)?.getAttribute("data-hide-sidebar")).toBe("true");
    }
  });
});
