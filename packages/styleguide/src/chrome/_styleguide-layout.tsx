/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide section's page shell — a THIN wrapper over
// `@takazudo/zudo-doc`'s `DocLayoutWithDefaults`, reusing the docs chrome
// instead of vendoring its own header/footer/sidebar. The whole point of this
// wrapper is that a `/components` section looks and behaves like a
// first-class docs section: same 3-region DocLayout shell, same header, same
// footer, same body-end islands, differing ONLY in which nav tree the sidebar
// shows.
//
// Host boundary (ADR docs/adr/styleguide-engine.md, #653): this module lives
// in the engine package, so it must not read a host's settings/i18n/registry
// singletons directly — those flow in as props (`navNodes`, `sidebarToggle`,
// `enableClientRouter`, `noindex`, `lang`). The host composes them from its own
// `settings` object and its generated `navNodes` tree (see
// `src/styleguide/nav-nodes.ts` in the root host) and passes them straight
// through.
//
// Slot wiring (DocLayoutWithDefaults):
//   header / footer / head / bodyEnd → passed in by the host page (its docs
//                     `HeaderWithDefaults` / `FooterWithDefaults` /
//                     `HeadWithDefaults` / `BodyEndIslands`). No bespoke
//                     styleguide chrome.
//   sidebarOverride → `@takazudo/zudo-doc/sidebar-tree-island`'s `SidebarTree`
//                     fed the host's `navNodes` prop instead of the docs tree.
//                     Wrapped here in `<Island when="load">` — an override slot
//                     is responsible for its own hydration marker (see
//                     @takazudo/zudo-doc sidebar.d.ts).
//   afterSidebar    → the package sidebar-toggle prepaint factory, which owns
//                     the load island; its visibility script extends `head`.
//   tocOverride     → the right-region code panel content on detail pages
//                     (#49), passed in via the `codePanel` prop. `<></>` (and
//                     `hideToc`) when absent so the content band fills the
//                     freed width.
//   headerOverride  → the host-supplied header, verbatim.
//
// This shell adds NO chrome of its own to the header (#541): the two
// styleguide-only controls that used to overlay the framework header (the
// code-panel toggle and the Preview tokens trigger) live in the detail page's
// own workbench toolbar instead, beside the previews they act on.
//
// The active-item highlight is owned by the root SidebarTree's `useActiveSlug`,
// which derives the active slug from the URL on each page load — there is no
// separate active-slug-sync script in this layout.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { SidebarTree } from "@takazudo/zudo-doc/sidebar-tree-island";
import {
  createSidebarPrepaint,
  createSidebarVisibilityPrepaint,
} from "@takazudo/zudo-doc/sidebar-prepaint";
import type { NavNode } from "../registry/nav-nodes.js";
import { PanelStateHeadScript, PanelResizersInitScript } from "./panel-scripts.js";

export interface StyleguideLayoutProps {
  /**
   * Already-composed meta title (e.g. `composeMetaTitle("Components")`).
   * Passed pre-composed because the title-composition helper is a host-owned
   * concern and this package must not import the host's page tree.
   */
  title: string;
  /**
   * Active sidebar slug for the initial SSR highlight. The catalog landing
   * passes "" (the Overview leaf); a story detail page passes its story slug.
   * Ignored when the sidebar is hidden. `useActiveSlug` re-derives this from
   * the URL on each page load, so this is just the initial value.
   */
  activeSlug?: string;
  /** Active locale — the host's `defaultLocale` or a page's explicit locale. */
  lang: string;
  /** Hide the component sidebar for standalone pages such as /tokens. */
  hideSidebar?: boolean;
  /** `<head>` content — the host passes its `HeadWithDefaults` output. */
  head: ComponentChildren;
  /** Header region — the host passes its `HeaderWithDefaults` output. */
  header: ComponentChildren;
  /** Footer region — the host passes its `FooterWithDefaults` output. */
  footer: ComponentChildren;
  /** Body-end islands — the host passes its `BodyEndIslands` output. */
  bodyEnd: ComponentChildren;
  /**
   * Right-region code panel content (detail pages only, #49). When present the
   * TOC slot hosts it; when absent the slot is empty and `hideToc` frees the
   * width.
   */
  codePanel?: VNode | null;
  /**
   * Opt the content band into the DocLayout **wide** layout — forwarded
   * verbatim to `DocLayoutWithDefaults contentWide`. Defaults to `false`.
   */
  contentWide?: boolean;
  /**
   * The sidebar's nav tree — the host's generated styleguide nav (built with
   * `@takazudo/zudo-sg/registry`'s `buildNavNodes`). Ignored when
   * `hideSidebar` is set.
   */
  navNodes: NavNode[];
  /** Mirrors the host's `settings.sidebarToggle` feature flag. */
  sidebarToggle: boolean;
  /**
   * Mirrors the host's `settings.dynamicPageTransition` — forwarded to
   * `DocLayoutWithDefaults`'s `enableClientRouter`.
   */
  enableClientRouter: boolean;
  /** Mirrors the host's `settings.noindex`. */
  noindex: boolean;
  children: JSX.Element | JSX.Element[];
}

export function StyleguideLayout({
  title,
  activeSlug,
  lang,
  hideSidebar = false,
  head,
  header,
  footer,
  bodyEnd,
  codePanel,
  contentWide,
  navNodes,
  sidebarToggle,
  enableClientRouter,
  noindex,
  children,
}: StyleguideLayoutProps): JSX.Element {
  const showCodePanel = Boolean(codePanel);

  const sidebarToggleSettings = { sidebarToggle };
  const SidebarPrepaint = createSidebarPrepaint(sidebarToggleSettings);
  const SidebarVisibilityPrepaint = createSidebarVisibilityPrepaint(sidebarToggleSettings);

  // Wrap the root <SidebarTree> directly in <Island when="load"> — mirrors
  // the host's `_sidebar-with-defaults.tsx`. The override slot is responsible
  // for emitting its own `data-zfb-island="SidebarTree"` hydration marker
  // (DocLayout only does this for its built-in data path). Feeding the
  // host's `navNodes` is the only difference from the docs sidebar — no
  // rootMenuItems here, so the tree always shows the component tree (never the
  // root-menu fallback). `currentSlug` seeds the SSR highlight. Hidden-sidebar
  // pages keep the package's sr-only aside empty, without a component tree.
  const sidebarOverride = hideSidebar
    ? <></>
    : Island({
      when: "load",
      children: <SidebarTree nodes={navNodes} currentSlug={activeSlug} />,
    }) as unknown as VNode;

  // The right-region (DocLayout's TOC slot) hosts the detail-page code panel
  // (#49). Empty fragment when absent so `hideToc` lets the content band fill
  // the full width on the catalog + token routes.
  const tocOverride: VNode = showCodePanel ? (codePanel as VNode) : <></>;

  // Panel scripts: PanelStateHeadScript runs in <head> (passed via head slot
  // extension); PanelResizersInitScript runs at body-end (appended to bodyEnd).
  const composedHead = (
    <>
      {head}
      <SidebarVisibilityPrepaint hideSidebar={hideSidebar} />
      <PanelStateHeadScript />
    </>
  );

  const composedBodyEnd = (
    <>
      {bodyEnd}
      <PanelResizersInitScript />
    </>
  );

  return (
    <DocLayoutWithDefaults
      title={title}
      enableClientRouter={enableClientRouter}
      head={composedHead}
      lang={lang}
      noindex={noindex}
      hideSidebar={hideSidebar}
      hideToc={!showCodePanel}
      contentWide={contentWide}
      {...(!hideSidebar ? { sidebarPersistKey: `sidebar-${lang}-components` } : {})}
      headerOverride={header}
      sidebarOverride={sidebarOverride}
      afterSidebar={<SidebarPrepaint hideSidebar={hideSidebar} />}
      tocOverride={tocOverride}
      footerOverride={footer}
      bodyEndComponents={composedBodyEnd}
    >
      {children}
    </DocLayoutWithDefaults>
  );
}
