/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The styleguide section's page shell — a THIN wrapper over the root site's
// `DocLayoutWithDefaults`, reusing the docs chrome instead of vendoring its
// own header/footer/sidebar. The whole point of this wrapper is that the
// `/components` section looks and behaves like a first-class docs section:
// same 3-region DocLayout shell, same header, same footer, same body-end
// islands (zdtp panel, client router, image/mermaid enlarge), differing ONLY
// in which nav tree the sidebar shows.
//
// Architectural boundary: this file lives in `src/`, which is part of the
// `pnpm check` (tsc) program, whereas the docs chrome defaults
// (`HeaderWithDefaults` / `FooterWithDefaults` / `HeadWithDefaults` /
// `BodyEndIslands`) live in `pages/lib/*`, which tsconfig deliberately
// EXCLUDES from tsc (they depend on the `zfb/content` virtual module and the
// relaxed page-tree JSX typing the build pipeline provides, not tsc). A static
// `src → pages` import would drag those excluded files into tsc and fail the
// type-check. So the chrome slots are passed IN as props: the page module
// (under `pages/`, which may import `pages/lib/*` freely) composes them and
// hands them to this shell. The shell owns only the DocLayout wiring plus the
// one styleguide-specific piece that genuinely belongs in `src/` — the sidebar
// (root `SidebarTree` island fed the styleguide `navNodes`).
//
// Slot wiring (DocLayoutWithDefaults):
//   header / footer / head / bodyEnd → passed in by the page (the docs
//                     `HeaderWithDefaults` / `FooterWithDefaults` /
//                     `HeadWithDefaults` / `BodyEndIslands`). No bespoke
//                     styleguide chrome.
//   sidebarOverride → root `SidebarTree` island fed the styleguide `navNodes`
//                     (src/styleguide/data/nav-nodes.ts) instead of the docs
//                     tree. Wrapped here in `<Island when="load">` exactly like
//                     `pages/lib/_sidebar-with-defaults.tsx` does — an override
//                     slot is responsible for its own hydration marker (see
//                     @takazudo/zudo-doc sidebar.d.ts).
//   tocOverride     → the right-region CodeMirror code panel on detail pages
//                     (#49). `<></>` (and `hideToc`) when absent so the content
//                     band fills the freed width.
//   headerOverride  → page-supplied HeaderWithDefaults PLUS the SgHeaderToggles
//                     island, composed so the styleguide token icons read as
//                     part of the header's right region (not a strip below).
//
// SgHeaderToggles is emitted by this layout directly (not the page) because it
// belongs to the src/ boundary and is styleguide-specific, not host-chrome. It
// holds the styleguide-only token icons: the Preview tokens icon (and the Code
// panel toggle on detail pages). The site-wide Design Tokens icon is injected
// into the framework header right region by HeaderWithDefaults — so styleguide
// pages show two token icons (Design Tokens + Preview tokens) and regular docs
// pages show one (Takazudo/zudo-sg#84/#85).
//
// Placement: the framework `<Header>` is a self-contained sticky `<header>` with
// no host-island slot in its right region, so SgHeaderToggles is composed as a
// sibling and overlaid into the header band by the `.sg-header-toggles` CSS
// block in global.css (a sticky, height-collapsed bar pulled up over the header
// row and right-aligned). This makes the Preview tokens icon read as a header
// right-region icon rather than an in-flow strip below the sticky header.
//
// The active-item highlight is owned by the root SidebarTree's `useActiveSlug`,
// which derives the active slug from the URL on each page load — there is no
// separate active-slug-sync script in this layout.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { settings } from "@/config/settings";
import { defaultLocale, type Locale } from "@/config/i18n";
import { navNodes } from "@/styleguide/data/nav-nodes";
import { SidebarTree } from "@takazudo/zudo-doc/sidebar-tree-island";
import SgHeaderToggles from "./header-toggles";
import { PanelStateHeadScript, PanelResizersInitScript } from "./panel-scripts";

export interface StyleguideLayoutProps {
  /**
   * Already-composed meta title (e.g. `composeMetaTitle("Components")`).
   * Passed pre-composed because the composer lives in `pages/lib` and this
   * `src/` shell must not import from the excluded `pages/` tree.
   */
  title: string;
  /**
   * Active sidebar slug for the initial SSR highlight. The catalog landing
   * passes "" (the Overview leaf); a story detail page passes its story slug;
   * the tokens route passes "tokens". `useActiveSlug` re-derives this from
   * the URL on each page load, so this is just the initial value.
   */
  activeSlug?: string;
  /** Active locale; defaults to the configured defaultLocale. */
  lang?: Locale;
  /** `<head>` content — the page passes `<HeadWithDefaults … />`. */
  head: ComponentChildren;
  /** Header region — the page passes `<HeaderWithDefaults … />`. */
  header: ComponentChildren;
  /** Footer region — the page passes `<FooterWithDefaults … />`. */
  footer: ComponentChildren;
  /** Body-end islands — the page passes `<BodyEndIslands … />`. */
  bodyEnd: ComponentChildren;
  /**
   * Right-region code panel content (detail pages only, #49). When present the
   * TOC slot hosts it; when absent the slot is empty and `hideToc` frees the
   * width.
   */
  codePanel?: VNode | null;
  children: JSX.Element | JSX.Element[];
}

export function StyleguideLayout({
  title,
  activeSlug,
  lang = defaultLocale,
  head,
  header,
  footer,
  bodyEnd,
  codePanel,
  children,
}: StyleguideLayoutProps): JSX.Element {
  const showCodePanel = Boolean(codePanel);

  // Wrap the root <SidebarTree> directly in <Island when="load"> — mirrors
  // `pages/lib/_sidebar-with-defaults.tsx`. The override slot is responsible
  // for emitting its own `data-zfb-island="SidebarTree"` hydration marker
  // (DocLayout only does this for its built-in data path). Feeding the
  // styleguide `navNodes` is the only difference from the docs sidebar — no
  // rootMenuItems here, so the tree always shows the component tree (never the
  // root-menu fallback). `currentSlug` seeds the SSR highlight.
  const sidebarOverride = Island({
    when: "load",
    children: <SidebarTree nodes={navNodes} currentSlug={activeSlug} />,
  }) as unknown as VNode;

  // The right-region (DocLayout's TOC slot) hosts the detail-page code panel
  // (#49). Empty fragment when absent so `hideToc` lets the content band fill
  // the full width on the catalog + token routes.
  const tocOverride: VNode = showCodePanel ? (codePanel as VNode) : <></>;

  // SgHeaderToggles island — composed as a sibling after the page-supplied
  // header in the headerOverride slot, then overlaid into the header band by the
  // `.sg-header-toggles` CSS block (see global.css). Exposes the styleguide
  // Preview tokens icon + the code-panel toggle (detail pages) from every
  // component route. The `.sg-header-toggles` wrapper is the overlay hook.
  const headerToggles = (
    <div class="sg-header-toggles">
      {
        Island({
          when: "load",
          children: <SgHeaderToggles showCodePanel={showCodePanel} />,
        }) as unknown as VNode
      }
    </div>
  );

  // Composed header: the page-supplied HeaderWithDefaults + styleguide toggles.
  // The `.sg-header-region` wrapper is the positioning context + overlay scope:
  // its CSS (global.css) reserves right padding inside the framework header for
  // the overlaid styleguide token icons and pins `.sg-header-toggles` into that
  // reserved slot, so they read as header right-region icons.
  const composedHeader = (
    <div class="sg-header-region">
      {header}
      {headerToggles}
    </div>
  );

  // Panel scripts: PanelStateHeadScript runs in <head> (passed via head slot
  // extension); PanelResizersInitScript runs at body-end (appended to bodyEnd).
  const composedHead = (
    <>
      {head}
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
      enableClientRouter={settings.dynamicPageTransition}
      head={composedHead}
      lang={lang}
      noindex={settings.noindex}
      hideToc={!showCodePanel}
      sidebarPersistKey={`sidebar-${lang}-components`}
      headerOverride={composedHeader}
      sidebarOverride={sidebarOverride}
      tocOverride={tocOverride}
      footerOverride={footer}
      bodyEndComponents={composedBodyEnd}
    >
      {children}
    </DocLayoutWithDefaults>
  );
}
