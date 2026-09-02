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
//   headerOverride  → the page-supplied HeaderWithDefaults, verbatim.
//
// This shell adds NO chrome of its own to the header (#541). It used to
// compose an `SgHeaderToggles` island as a sibling and overlay it into the
// framework header band — a sticky, height-collapsed, negative-margined,
// `pointer-events: none` bar — on the premise that the framework `<Header>`
// exposes no host slot. It does: the host already ships its site-wide Design
// Tokens icon through `settings.headerRightItems` (#113), which is untouched
// and still renders on package-owned doc routes. The two styleguide-only
// controls that overlay carried — the code-panel toggle and the Preview tokens
// trigger — now live in the detail page's own workbench toolbar, beside the
// previews they act on rather than on every route including `/docs`.
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
import { PanelStateHeadScript, PanelResizersInitScript } from "./panel-scripts";

export interface StyleguideLayoutProps {
  /**
   * Already-composed meta title (e.g. `composeMetaTitle("Components")`).
   * Passed pre-composed because the title-composition helper lives in `pages/lib` and this
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
  /**
   * Opt the content band into the DocLayout **wide** layout — forwarded
   * verbatim to `DocLayoutWithDefaults contentWide`, which sets
   * `data-zd-wide` on `.zd-doc-content-band` and widens the reading column
   * cap from `clamp(50rem,75vw,90rem)` to `clamp(50rem,92.5vw,120rem)` (see
   * `@takazudo/zudo-doc/dist/features.css`). Defaults to `false`.
   */
  contentWide?: boolean;
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
  contentWide,
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
      contentWide={contentWide}
      sidebarPersistKey={`sidebar-${lang}-components`}
      headerOverride={header}
      sidebarOverride={sidebarOverride}
      tocOverride={tocOverride}
      footerOverride={footer}
      bodyEndComponents={composedBodyEnd}
    >
      {children}
    </DocLayoutWithDefaults>
  );
}
