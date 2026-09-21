/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// zudo-doc chrome reconstruction for the engine routes (ADR
// docs/adr/styleguide-engine.md decision 10). Model: zudo-doc's
// routes/_chrome.tsx. Sole importer of `virtual:zudo-doc-route-context` and
// `virtual:zudo-doc-chrome-bindings` (both registered by
// `@takazudo/zudo-doc/plugins/routes`, which the engine routes plugin requires).
//
// The host's `chromeBindings` are spread verbatim, so its BodyEndIslands
// override (doc-chrome token panel, preview token panel, enlarge islands)
// mounts on the engine routes exactly as on the zudo-doc doc routes.

import type { JSX } from "preact";
import { routeContext } from "virtual:zudo-doc-route-context";
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";
import { createRouteContext, type RouteContextPayload } from "@takazudo/zudo-doc/route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";
import type { StyleguideLayoutProps } from "../chrome/index.js";
import { buildNavNodes } from "../registry/index.js";
import { ctx, withBase } from "./_context.js";
import { registry } from "./_registry.js";

export const routeCtx = createRouteContext(routeContext as unknown as RouteContextPayload);
export const settings = routeCtx.settings;
export const locale = routeCtx.defaultLocale;

const chrome = createChrome(routeCtx, chromeBindings);
export const { composeMetaTitle } = chrome;

/** The styleguide sidebar tree, built once and shared by every engine route. */
export const navNodes = buildNavNodes(registry, { withBase, routes: ctx.routes });

export interface ChromeSlotOptions {
  /** Raw page title — HeadWithDefaults composes "<title> | <siteName>". */
  pageTitle: string;
  /** Root-absolute route path before the base prefix. */
  path: string;
  /** Extra `<head>` content appended after HeadWithDefaults. */
  extraHead?: JSX.Element;
  /** Active styleguide slug; with `hideSidebar` unset it also scopes the mobile drawer. */
  activeSlug?: string;
  /** Standalone page (e.g. /tokens): the mobile drawer keeps the root menu. */
  hideSidebar?: boolean;
}

type ChromeProps = Pick<
  StyleguideLayoutProps,
  "title" | "lang" | "head" | "header" | "footer" | "bodyEnd" | "navNodes" | "sidebarToggle" | "enableClientRouter" | "noindex"
>;

/** Every StyleguideLayout prop that comes from the doc chrome and the site settings. */
export function chromeProps({ pageTitle, path, extraHead, activeSlug, hideSidebar = false }: ChromeSlotOptions): ChromeProps {
  const { HeadWithDefaults, HeaderWithDefaults, FooterWithDefaults, BodyEndIslands } = chrome;
  const head = <HeadWithDefaults title={pageTitle} />;
  // `sidebarNodes` (zudo-doc >= 5.25.0, zudolab/zudo-doc#4212) hands the
  // registry-built tree straight to the mobile drawer, so the engine routes get
  // the component tree without the host having to bind a replacement `Header`.
  // The array form is passed to `SidebarToggle` verbatim — no default build, no
  // version-href remapping — which is what these non-docs routes need.
  const headerProps: Parameters<typeof HeaderWithDefaults>[0] = {
    lang: locale,
    currentPath: withBase(path),
    ...(hideSidebar ? {} : { sidebarNodes: navNodes, currentSlug: activeSlug }),
  };
  return {
    title: composeMetaTitle(pageTitle),
    lang: locale,
    head: extraHead ? (
      <>
        {head}
        {extraHead}
      </>
    ) : (
      head
    ),
    header: <HeaderWithDefaults {...headerProps} />,
    footer: <FooterWithDefaults lang={locale} />,
    // Marker for the header trigger's visibility script (sibling issue #814):
    // `document.querySelector("[data-sg-engine-route]")` after every
    // navigation. It sits in bodyEnd, not the header, because the header
    // carries `data-zfb-transition-persist` — the client router lifts it
    // whole across a swap, so a marker there would go stale after navigating
    // to a docs page. bodyEnd has no persist key, so it is discarded and
    // freshly re-rendered per route like the rest of the body.
    bodyEnd: (
      <>
        <BodyEndIslands basePath={ctx.base} />
        <div hidden data-sg-engine-route />
      </>
    ),
    navNodes,
    sidebarToggle: Boolean(settings.sidebarToggle),
    enableClientRouter: Boolean(settings.dynamicPageTransition),
    noindex: Boolean(settings.noindex),
  };
}
