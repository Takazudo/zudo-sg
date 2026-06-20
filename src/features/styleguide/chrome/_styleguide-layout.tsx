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
//   tocOverride     → RESERVED for the right-region CodeMirror code panel on
//                     detail pages (wired in #49). `<></>` (and `hideToc`) when
//                     absent so the content band fills the freed width.
//
// The active-item highlight is owned by the root SidebarTree's `useActiveSlug`,
// which (since #46) also listens to AFTER_NAVIGATE_EVENT for soft-nav — there
// is no separate active-slug-sync script in this layout.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { settings } from "@/config/settings";
import { defaultLocale, type Locale } from "@/config/i18n";
import { navNodes } from "@/styleguide/data/nav-nodes";
import SidebarTree from "@/components/sidebar-tree";

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
   * the tokens route passes "tokens". `useActiveSlug` re-derives this from the
   * URL on soft-nav, so this is just the initial value.
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
   * width. Reserved now so the detail-page layout (#48) and the code panel
   * (#49) can flow it through without changing this contract.
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

  // The right-region (DocLayout's TOC slot) is reserved for the detail-page
  // code panel (#49). Empty fragment until then so `hideToc` lets the content
  // band fill the full width on the catalog + token routes.
  const tocOverride: VNode = showCodePanel ? (codePanel as VNode) : <></>;

  return (
    <DocLayoutWithDefaults
      title={title}
      head={head}
      lang={lang}
      noindex={settings.noindex}
      hideToc={!showCodePanel}
      headerOverride={header}
      sidebarOverride={sidebarOverride}
      tocOverride={tocOverride}
      footerOverride={footer}
      bodyEndComponents={bodyEnd}
    >
      {children}
    </DocLayoutWithDefaults>
  );
}
