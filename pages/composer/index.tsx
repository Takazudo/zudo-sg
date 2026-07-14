/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// `/composer` — the Composer document shell (issue #247).
//
// Deliberately does NOT go through `DocLayoutWithDefaults` / StyleguideLayout.
// Both inject a docs sidebar `<aside id="desktop-sidebar">`, a TOC region, a
// footer, and — most importantly — wrap `main` in a PADDED, max-width article
// band (`.zd-doc-content-band` → `<main class="... px-hsp-xl py-vsp-xl ...">`
// → `<article class="zd-content max-w-none">`, see
// `@takazudo/zudo-doc/doclayout`'s `doc-layout.js`). The Composer workspace
// needs the FULL viewport width below the header for its five-track grid, so
// this page owns a bespoke `<html>` document instead — mirroring how
// `pages/components/preview.tsx` and `pages/preview/contact.tsx` own their
// own documents, except this one keeps the REAL shared header (composed from
// the same `pages/lib/*` defaults every other route uses) and participates in
// the SPA client router.
//
// SPA-router participation: `<ClientRouter>` is mounted directly here (not
// via DocLayout) so `/composer` can be entered by a soft navigation from
// another page, and so header link clicks trigger the same
// `zfb:before-preparation` event `src/features/composer/chrome/
// navigation-guard.ts` listens on to guard against losing unsaved edits.
// `preserveHtmlAttrs` mirrors DocLayout's own list so `data-theme` / `style`
// (the color-scheme bootstrap) survive a swap into or out of this page.
//
// Chrome composition boundary: the docs chrome defaults live under
// `pages/lib/*` (tsc-EXCLUDED — they depend on the `zfb/content` virtual
// module), so this page (under `pages/`, free to import `pages/lib/*`)
// composes them via `_composer-chrome.tsx` and hands the slots, plus the
// `src/`-side `ComposerApp` island, to the document below. No `src` module
// imports `pages/lib/*` directly — that boundary is unchanged by this route.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";
import { defaultLocale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import ComposerApp from "@/features/composer/chrome/composer-app";
import {
  ComposerResizerInitScript,
  ComposerResizerRestoreScript,
} from "@/features/composer/chrome/resizer-scripts";
import { composeMetaTitle } from "../lib/_compose-meta-title";
import { buildComposerChrome } from "../lib/_composer-chrome";

export const frontmatter = { title: "Composer" };

export default function ComposerPage(): JSX.Element {
  const locale = defaultLocale;
  const currentPath = withBase("/composer");
  const chrome = buildComposerChrome({
    lang: locale,
    pageTitle: "Composer",
    currentPath,
  });

  // The whole workspace is client-only state (the document lives in
  // localStorage, not SSR data) — `when: "load"` hydrates immediately rather
  // than waiting on visibility/idle, since the workspace IS the page.
  const app = Island({
    when: "load",
    // zfb keeps the skip-SSR fallback in the island container when it mounts
    // the client tree. Reusing the full-height workspace shell here therefore
    // left an empty viewport-sized sibling before the library and pushed the
    // real UI below the fold. Keep this marker inert and zero-sized.
    ssrFallback: <div aria-hidden="true" data-sg-composer-loading />,
    children: <ComposerApp />,
  }) as unknown as VNode;

  return (
    <html lang={locale} data-sg-composer-doc>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{composeMetaTitle("Composer")}</title>
        {/* A live authoring workspace, not indexable content. */}
        <meta name="robots" content="noindex, nofollow" />
        {
          ClientRouter({
            preserveHtmlAttrs: ["data-sidebar-hidden", "data-theme", "style"],
          }) as unknown as VNode
        }
        {chrome.head}
        <ComposerResizerRestoreScript />
      </head>
      <body class="min-h-screen antialiased">
        {chrome.header}
        {app}
        {chrome.bodyEnd}
        <ComposerResizerInitScript />
      </body>
    </html>
  );
}
