/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Chrome-slot builder for the host-owned `/sitemapper` route (#400).
//
// The docs chrome defaults (HeadWithDefaults / HeaderWithDefaults /
// BodyEndIslands) stay under `pages/lib/*`, the tsc-excluded page tree that
// owns the `zfb/content` virtual module. The page composes these slots here
// and passes them to its own document shell, keeping the `src/` tree from
// importing `pages/lib/*` and accidentally widening the typecheck graph.
//
// Sitemapper intentionally has no footer. It is a full-width authoring
// workspace, not a docs article, so it does not route through
// DocLayoutWithDefaults.

import type { JSX } from "preact";
import { settings } from "@/config/settings";
import type { Locale } from "@/config/i18n";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { BodyEndIslands } from "./_body-end-islands";

export interface SitemapperChromeOptions {
  /** Active locale (defaults handled by the caller). */
  lang: Locale | string;
  /** Raw page title — HeadWithDefaults composes "<title> | <siteName>". */
  pageTitle: string;
  /** Current page URL path (base-prefixed) for header active-state. */
  currentPath: string;
}

export interface SitemapperChromeSlots {
  head: JSX.Element;
  header: JSX.Element;
  bodyEnd: JSX.Element;
}

/** Builds the three shared chrome slots rendered by `/sitemapper`. */
export function buildSitemapperChrome({
  lang,
  pageTitle,
  currentPath,
}: SitemapperChromeOptions): SitemapperChromeSlots {
  return {
    head: <HeadWithDefaults title={pageTitle} />,
    header: <HeaderWithDefaults lang={lang} currentPath={currentPath} />,
    bodyEnd: <BodyEndIslands basePath={settings.base ?? "/"} />,
  };
}
