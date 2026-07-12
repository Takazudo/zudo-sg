import type { ComponentChildren } from "preact";
import { Island, type IslandProps } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";

import "../styles/global.css";

// Site chrome, consumed via @zudo-sg/ui subpaths (the barrel is rebuilt in a
// later wave — see the epic's "new components stay OUT of index.ts" rule).
import { SiteHeader, type BrandSwitcherItem } from "@zudo-sg/ui/src/chrome/site-header/site-header.tsx";
import { SiteNav } from "@zudo-sg/ui/src/chrome/site-nav/site-nav.tsx";
import { SiteFooter } from "@zudo-sg/ui/src/chrome/site-footer/site-footer.tsx";
import { Breadcrumbs } from "@zudo-sg/ui/src/chrome/breadcrumbs/breadcrumbs.tsx";
import NavEnhancer from "@zudo-sg/ui/src/chrome/nav-enhancer/nav-enhancer.tsx";
import MobileNavEnhancer from "@zudo-sg/ui/src/chrome/mobile-nav-enhancer/mobile-nav-enhancer.tsx";
import ContextSwitcherEnhancer from "@zudo-sg/ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer.tsx";
import SearchToggleEnhancer from "@zudo-sg/ui/src/chrome/search-toggle-enhancer/search-toggle-enhancer.tsx";

import { getSiteTree, getBreadcrumbs } from "../lib/site-tree";
import { composeMetaTitle, absoluteUrl } from "../lib/meta";
import { siteMeta } from "../config/site-meta";

// SPA router pieces. zfb-runtime-coupled, so they live here rather than in
// @zudo-sg/ui (which stays zfb-free — see the epic's key architectural rules).
import ClientRouterBootstrap from "../components/router/client-router-bootstrap";
import PageLoadingOverlay from "../components/router/page-loading-overlay";

type Props = {
  title?: string;
  description?: string;
  /** Absolute OGP image URL. Omitted entirely (no og:image/twitter:image) when unset. */
  ogImage?: string;
  /** This page's canonical path (e.g. `/company/about`). Converted to an absolute URL when `siteMeta.siteUrl` is set. */
  canonical?: string;
  /** Current page slug — feeds breadcrumbs + nav active-state. Omit for the home page. */
  slug?: string;
  /** Active business-line key, derived by pages/[...slug].tsx from the `lines/<key>/` slug prefix. */
  line?: string;
  /** Adds `<meta name="robots" content="noindex">` (e.g. the 404 page). */
  noindex?: boolean;
  children: ComponentChildren;
};

// Same value as siteMeta.siteName so composeMetaTitle() doesn't append a
// redundant "| Demo Site" suffix on the home page.
const DEFAULT_TITLE = siteMeta.siteName;
const DEFAULT_DESCRIPTION =
  "A demo content site composed from the shared @zudo-sg/ui component library.";

/**
 * Single-entry brand-switcher list standing in for "corporate + business
 * lines" until a richer per-line registry lands (config/lines.ts — see
 * lib/site-tree.ts's module doc for why that's out of this wave's scope).
 * SiteHeader/SiteNav's switcher UI renders fine with one always-current
 * entry; a later wave adds more.
 */
function buildSwitcherItems(): BrandSwitcherItem[] {
  return [
    {
      key: "corporate",
      label: siteMeta.siteName,
      href: "/",
      mark: siteMeta.siteName.charAt(0) || "D",
      description: "",
      domain: "",
      current: true,
    },
  ];
}

/**
 * Shared page chrome: document shell (grid rail + main column), SiteHeader/
 * SiteNav/SiteFooter/Breadcrumbs from @zudo-sg/ui, the SPA router, and the
 * a11y-enhancer islands each component's SSR baseline works without.
 *
 * Layout (`.grid grid-cols-[13rem_minmax(0,1fr)]`):
 *   SiteNav is `position:fixed` (left rail, 13rem) — it's out of the grid's
 *   in-flow sizing, so the main column MUST be `col-start-2` explicitly or
 *   it auto-places into column 1 (the rail's width) and renders "empty"
 *   behind the fixed nav. Collapses to one column below `sm`, where SiteNav
 *   itself switches to its off-canvas drawer + fixed slim top bar
 *   (`h-[3.25rem]`) — `max-sm:pt-[3.25rem]` on the main column keeps content
 *   clear of that bar.
 *
 * `data-line` on `<html>` is the per-line theming hook (`[data-line="<key>"]`
 * CSS overrides land in #234's styles/lines.css). Unlike the reference this
 * shell is adapted from, `@zudo-sg/ui`'s ported SiteHeader/SiteNav (#226)
 * hardcode their shared 4rem header height directly in both components
 * rather than reading a shared `--gh-h` custom property, so this layout
 * doesn't define one — there's nothing that would consume it.
 */
export default function DefaultLayout({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ogImage,
  canonical,
  slug,
  line,
  noindex = false,
  children,
}: Props) {
  const tree = getSiteTree(line);
  const crumbs = getBreadcrumbs(slug, tree, line);
  const switcherItems = buildSwitcherItems();
  const brand = siteMeta.siteName;

  const canonicalAbsolute = canonical ? absoluteUrl(canonical) : undefined;
  const metaTitle = composeMetaTitle(title);

  return (
    <html lang="en" data-line={line}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={description} />
        {noindex && <meta name="robots" content="noindex" />}
        <title>{metaTitle}</title>

        {canonicalAbsolute && <link rel="canonical" href={canonicalAbsolute} />}

        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content={siteMeta.siteName} />
        {canonicalAbsolute && <meta property="og:url" content={canonicalAbsolute} />}
        {ogImage && <meta property="og:image" content={ogImage} />}

        <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={description} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}

        {/* SPA soft-swap navigation. Mounted once in <head> per the zfb docs. */}
        <ClientRouter />
      </head>
      <body>
        {/* Skip link (a11y) — visible only when focused. */}
        <a
          class="absolute start-hsp-md top-vsp-xs z-ui-toast -translate-y-[200%] rounded bg-accent px-hsp-md py-vsp-2xs text-bg transition-transform focus:translate-y-0"
          href="#main"
        >
          Skip to content
        </a>

        <SiteHeader switcherItems={switcherItems} brand={brand} brandHref="/" />

        <div class="grid min-h-screen grid-cols-[13rem_minmax(0,1fr)] max-sm:grid-cols-[minmax(0,1fr)]">
          <SiteNav
            sections={tree.sections}
            brand={brand}
            brandHref="/"
            currentSlug={slug}
            switcherItems={switcherItems}
          />

          <div class="col-start-2 flex min-h-screen min-w-0 flex-col max-sm:col-start-1 max-sm:pt-[3.25rem]">
            <Breadcrumbs crumbs={crumbs} />
            <main id="main" class="flex-[1_0_auto]">
              {children}
            </main>
            <SiteFooter sections={tree.sections} brand={brand} />
          </div>
        </div>

        {/* a11y-enhancer islands — each layers ARIA sync / focus handling
            on top of an SSR baseline (CSS `:hover`/`:focus-within`/checkbox
            hack / `<details>`) that already works without JS. ssrFallback={null}
            is required: evaluating these islands during SSR throws. */}
        <Island when="visible" ssrFallback={null}>
          {(<NavEnhancer />) as unknown as IslandProps["children"]}
        </Island>
        <Island when="visible" ssrFallback={null}>
          {(<MobileNavEnhancer />) as unknown as IslandProps["children"]}
        </Island>
        <Island when="visible" ssrFallback={null}>
          {(<ContextSwitcherEnhancer />) as unknown as IslandProps["children"]}
        </Island>
        <Island when="visible" ssrFallback={null}>
          {(<SearchToggleEnhancer />) as unknown as IslandProps["children"]}
        </Island>

        {/* Registers the router's click/form-submit intercept. when="load" so
            it's active before the first click; ssrFallback={null} for the
            same SSR-evaluation reason as the enhancers above. */}
        <Island when="load" ssrFallback={null}>
          {(<ClientRouterBootstrap />) as unknown as IslandProps["children"]}
        </Island>

        {/* Zero-hydration SSR markup + self-wiring script — not an island. */}
        <PageLoadingOverlay />
      </body>
    </html>
  );
}
