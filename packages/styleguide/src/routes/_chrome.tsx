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
}

type ChromeProps = Pick<
  StyleguideLayoutProps,
  "title" | "lang" | "head" | "header" | "footer" | "bodyEnd" | "navNodes" | "sidebarToggle" | "enableClientRouter" | "noindex"
>;

/** Every StyleguideLayout prop that comes from the doc chrome and the site settings. */
export function chromeProps({ pageTitle, path, extraHead }: ChromeSlotOptions): ChromeProps {
  const { HeadWithDefaults, HeaderWithDefaults, FooterWithDefaults, BodyEndIslands } = chrome;
  const head = <HeadWithDefaults title={pageTitle} />;
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
    // zudo-doc's package HeaderWithDefaults has no sidebar-nodes override, so
    // its mobile drawer shows the root menu rather than the component tree.
    header: <HeaderWithDefaults lang={locale} currentPath={withBase(path)} />,
    footer: <FooterWithDefaults lang={locale} />,
    bodyEnd: <BodyEndIslands basePath={ctx.base} />,
    navNodes,
    sidebarToggle: Boolean(settings.sidebarToggle),
    enableClientRouter: Boolean(settings.dynamicPageTransition),
    noindex: Boolean(settings.noindex),
  };
}
