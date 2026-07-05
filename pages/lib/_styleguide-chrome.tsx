/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared chrome-slot builder for the host-owned styleguide routes (#113).
//
// The three /components pages (index, [slug], tokens) each composed the same
// four DocLayout chrome slots — head / header / footer / bodyEnd — from the
// pages/lib/* defaults, differing only in title, current path, and active
// slug. That ~30-line block is centralised here so the pages stay focused on
// their content and the chrome stays in one place.
//
// Why these slots live in pages/lib (not src/): the chrome defaults own the
// `zfb/content` virtuals and the island import-chain, which the tsc-EXCLUDED
// page tree resolves. A static `src → pages` import would drag those excluded
// files into `pnpm check`. So the pages (already under pages/) build the slots
// via this helper and pass them into the src/-side `StyleguideLayout` shell.

import type { JSX } from "preact";
import { settings } from "@/config/settings";
import type { Locale } from "@/config/i18n";
import { navNodes } from "@/styleguide/data/nav-nodes";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { BodyEndIslands } from "./_body-end-islands";

export interface StyleguideChromeOptions {
  /** Active locale (defaults handled by the caller). */
  lang: Locale | string;
  /** Raw page title — HeadWithDefaults composes "<title> | <siteName>". */
  pageTitle: string;
  /** Current page URL path (base-prefixed) for header active-state. */
  currentPath: string;
  /** Active styleguide slug for the sidebar highlight. */
  activeSlug: string;
}

export interface StyleguideChromeSlots {
  head: JSX.Element;
  header: JSX.Element;
  footer: JSX.Element;
  bodyEnd: JSX.Element;
}

/**
 * Build the four DocLayout chrome slots shared by every /components page.
 * The styleguide mobile drawer uses the registry-built `navNodes` tree (not the
 * docs collection), so the header always gets `sidebarNodesOverride={navNodes}`.
 */
export function buildStyleguideChrome({
  lang,
  pageTitle,
  currentPath,
  activeSlug,
}: StyleguideChromeOptions): StyleguideChromeSlots {
  return {
    head: <HeadWithDefaults title={pageTitle} />,
    header: (
      <HeaderWithDefaults
        lang={lang}
        currentPath={currentPath}
        sidebarNodesOverride={navNodes}
        currentSlug={activeSlug}
      />
    ),
    footer: <FooterWithDefaults lang={lang} />,
    bodyEnd: <BodyEndIslands basePath={settings.base ?? "/"} />,
  };
}
