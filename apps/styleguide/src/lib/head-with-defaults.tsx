/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Color-scheme head injection for the styleguide pages.
//
// Why this wrapper exists: the v2 `<DocLayout>` shell exposes a `head` slot
// but intentionally does NOT mount `<ColorSchemeProvider>` — that is the
// host's responsibility. Without ColorSchemeProvider the runtime
// `:root { --zd-* }` palette is missing, so every component that resolves a
// color via `--zd-*` falls back to UA defaults.

import type { JSX } from "preact";
// Import ColorSchemeProvider from the dedicated subpath rather than the
// "@takazudo/zudo-doc/theme" barrel — the barrel also re-exports the
// ColorTweakExportModal island and design-token SerDe/iframe-bridge modules,
// which this SSR-only head emission does not need in its esbuild graph.
import ColorSchemeProvider from "@takazudo/zudo-doc/theme/color-scheme-provider";
import { composeMetaTitle } from "./compose-meta-title";
import { withBase, absoluteUrl } from "@/utils/base";
import { settings } from "@/config/settings";
import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
} from "@/config/color-scheme-utils";

export interface HeadWithDefaultsProps {
  /** Page title forwarded to og:title. Required. */
  title: string;
  /** Optional page description. */
  description?: string;
  /**
   * Absolute canonical URL for this page. When supplied, emits
   * <link rel="canonical" href="...">. Compute via `absoluteUrl(pageUrl)`
   * in each host page; returns undefined when settings.siteUrl is empty.
   */
  canonical?: string;
}

/**
 * Default-bearing host wrapper that injects the ColorSchemeProvider
 * (`:root { --zd-* }` palette + theme bootstrap), the favicon link, and an
 * optional canonical link into the v2 layout's `head` slot.
 *
 * Pure SSR — no state, no client-only imports.
 */
export function HeadWithDefaults({
  title,
  description: _description,
  canonical,
}: HeadWithDefaultsProps): JSX.Element {
  const { metaTags } = settings;

  const ogImageUrl =
    metaTags.ogImage !== false
      ? absoluteUrl(withBase(metaTags.ogImage))
      : undefined;

  // Map local ColorModeConfig to ColorSchemeProviderColorMode shape.
  // The provider requires `respectPrefersColorScheme` to be a boolean (not
  // optional), so we fill the default (true) when the field is omitted.
  const rawColorMode = settings.colorMode;
  const colorMode = rawColorMode
    ? {
        defaultMode: rawColorMode.defaultMode,
        respectPrefersColorScheme: rawColorMode.respectPrefersColorScheme ?? true,
      }
    : null;
  const cssText = rawColorMode
    ? generateLightDarkCssProperties()
    : generateCssCustomProperties();

  const composedTitle = composeMetaTitle(title);

  return (
    <>
      <title>{composedTitle}</title>
      <ColorSchemeProvider cssText={cssText} colorMode={colorMode} />
      {ogImageUrl !== undefined && (
        <>
          <meta property="og:title" content={composedTitle} />
          {metaTags.ogSiteName && (
            <meta property="og:site_name" content={settings.siteName} />
          )}
          <meta property="og:image" content={ogImageUrl} />
        </>
      )}
      {/* favicon set — withBase() handles the configured base path prefix */}
      <link rel="icon" href={withBase("/favicon.ico")} sizes="any" />
      <link rel="icon" type="image/png" sizes="32x32" href={withBase("/favicon-32x32.png")} />
      <link rel="icon" type="image/png" sizes="16x16" href={withBase("/favicon-16x16.png")} />
      {canonical !== undefined && <link rel="canonical" href={canonical} />}
    </>
  );
}
