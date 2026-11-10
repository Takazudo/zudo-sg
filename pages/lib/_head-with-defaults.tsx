// og:title / og:description / color-scheme / theme-pack head injection.
//
// The package `<DocLayout>` shell exposes a `head` slot and does not emit
// og:* meta, `<ColorSchemeProvider>`, or the theme-pack bootstrap on its own.
// Package-owned doc routes build that slot with `createHeadWithDefaults`,
// which also emits the theme-pack latch, the pre-paint bootstrap, and the
// no-JS `<noscript>` pack stylesheet (ADR theme-packs Decision 3).
//
// This host used to keep a hand copy of that head. The copy mounted
// ColorSchemeProvider and the favicon set, but it never grew the theme-pack
// emission, so `/` and `/docs/versions` server-rendered the Classic/base
// palette. Client navigation later applied the pack that a docs page had
// loaded. Delegate to the package factory so host-owned routes emit the same
// head the doc routes do, including `themePack: "default"` → Graphite.
//
// The `<html data-theme-pack>` attribute is not part of the head fragment.
// `themePackSsrSlug` is the value call sites pass as `DocLayoutWithDefaults`'
// `dataThemePack` prop (`resolveThemePackSsrSlug`).

import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { createHeadWithDefaults } from "@takazudo/zudo-doc/head-with-defaults";
import {
  createRouteContext,
  type RouteContextPayload,
} from "@takazudo/zudo-doc/route-context";
import { resolveThemePackSsrSlug } from "@takazudo/zudo-doc/theme";
import { routeContext as routeContextPayload } from "virtual:zudo-doc-route-context";

const routeCtx = createRouteContext(
  routeContextPayload as unknown as RouteContextPayload,
);

const PackageHeadWithDefaults = createHeadWithDefaults({
  ...routeCtx,
  components: {},
  hostBindings: {},
});

/**
 * Build-static `<html data-theme-pack>` value for host-owned layouts.
 * `undefined` when the routes plugin did not thread a theme-pack registry
 * (the feature stays inert, matching the package routes).
 */
export const themePackSsrSlug = resolveThemePackSsrSlug(
  routeCtx.themePackRegistry,
  routeCtx.settings,
);

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description forwarded to og:description. */
  description?: string;
  /**
   * Absolute canonical URL for this page. When supplied, emits
   * <link rel="canonical" href="...">. Compute via `absoluteUrl(pageUrl)`
   * (@/utils/base) in each host page; it returns undefined when
   * settings.siteUrl is empty so the link is simply omitted.
   */
  canonical?: string;
}

/**
 * Host head slot. Renders the package `createHeadWithDefaults` output:
 * og/twitter tags, ColorSchemeProvider, the theme-pack bootstrap (latch,
 * script, and the configured pack's `<noscript>` stylesheet), the sidebar
 * resizer restore script, and the favicon set.
 *
 * Pure SSR. Intended as:
 *   head={<HeadWithDefaults title={title} description={description} canonical={canonical} />}
 * on every DocLayoutWithDefaults call site in the host pages, together with
 * `dataThemePack={themePackSsrSlug}`.
 */
export function HeadWithDefaults(props: HeadWithDefaultsProps): JSX.Element {
  return <PackageHeadWithDefaults {...props} />;
}
