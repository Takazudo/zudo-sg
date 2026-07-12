/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Chrome-slot builder for the host-owned `/composer` route (#247).
//
// Mirrors `_styleguide-chrome.tsx`'s split: the docs chrome defaults
// (HeadWithDefaults / HeaderWithDefaults / BodyEndIslands) live under
// `pages/lib/*` — the tsc-EXCLUDED page tree that owns the `zfb/content`
// virtuals — so `pages/composer/index.tsx` (itself under `pages/`, free to
// import `pages/lib/*`) composes them here and hands the result to the
// `src/`-side ComposerApp island.
//
// UNLIKE `_styleguide-chrome.tsx`, there is no footer slot: `/composer`
// intentionally renders no footer (acceptance criterion) and owns its own
// document shell instead of routing through `DocLayoutWithDefaults` at all
// (see pages/composer/index.tsx's header comment for why: no docs sidebar/
// TOC/footer/padded article geometry).

import type { JSX } from "preact";
import { settings } from "@/config/settings";
import type { Locale } from "@/config/i18n";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { BodyEndIslands } from "./_body-end-islands";

export interface ComposerChromeOptions {
  /** Active locale (defaults handled by the caller). */
  lang: Locale | string;
  /** Raw page title — HeadWithDefaults composes "<title> | <siteName>". */
  pageTitle: string;
  /** Current page URL path (base-prefixed) for header active-state. */
  currentPath: string;
}

export interface ComposerChromeSlots {
  head: JSX.Element;
  header: JSX.Element;
  bodyEnd: JSX.Element;
}

/** Builds the three DocLayout-equivalent chrome slots `/composer` renders. */
export function buildComposerChrome({
  lang,
  pageTitle,
  currentPath,
}: ComposerChromeOptions): ComposerChromeSlots {
  return {
    head: <HeadWithDefaults title={pageTitle} />,
    header: <HeaderWithDefaults lang={lang} currentPath={currentPath} />,
    bodyEnd: <BodyEndIslands basePath={settings.base ?? "/"} />,
  };
}
