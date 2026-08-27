/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// `/sitemapper` — the Sitemapper document shell (issue #400).
//
// Like `/composer`, this route deliberately owns its own `<html>` document
// instead of going through `DocLayoutWithDefaults` / `StyleguideLayout`.
// Those layouts add the docs sidebar, TOC, footer, and a padded max-width
// article band; the Sitemapper workspace needs the full viewport width below
// the shared header.
//
// The page still composes the real shared head and header chrome and mounts
// `ClientRouter` directly. Keeping the router here lets a header click enter
// or leave the workspace through the same soft-navigation path as the other
// routes while preserving the theme attributes installed on `<html>`.
//
// The app is intentionally a client-only island. Its placeholder fallback is
// inert and zero-height: zfb leaves the fallback node in the island container
// when the client tree mounts, so a full-height loading shell would become an
// empty viewport-sized sibling and push the real workspace below the fold.
// The production Sitemapper app replaces this stable mount point in a later
// wave without changing the document shell.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import SitemapperApp from "@/features/sitemapper/chrome/sitemapper-app";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { buildSitemapperChrome } from "../lib/_sitemapper-chrome";

export const frontmatter = { title: "Sitemapper" };

export default function SitemapperPage(): JSX.Element {
  const locale = defaultLocale;
  const currentPath = withBase("/sitemapper");
  const chrome = buildSitemapperChrome({
    lang: locale,
    pageTitle: "Sitemapper",
    currentPath,
  });

  // The workspace is client-only state. Hydrate immediately because it is the
  // page itself rather than below-the-fold content.
  const app = Island({
    when: "load",
    // Keep this marker inert and zero-sized; see the route header above.
    ssrFallback: <div aria-hidden="true" data-sg-sitemapper-loading />,
    children: <SitemapperApp />,
  }) as unknown as VNode;

  return (
    <html lang={locale} data-sg-sitemapper-doc>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{composeMetaTitle("Sitemapper")}</title>
        {/* A live authoring workspace, not indexable content. */}
        <meta name="robots" content="noindex, nofollow" />
        {
          ClientRouter({
            preserveHtmlAttrs: ["data-sidebar-hidden", "data-theme", "style"],
          }) as unknown as VNode
        }
        {chrome.head}
      </head>
      <body class="min-h-screen antialiased">
        {chrome.header}
        {app}
        {chrome.bodyEnd}
      </body>
    </html>
  );
}
