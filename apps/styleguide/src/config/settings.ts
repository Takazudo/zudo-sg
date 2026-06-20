/**
 * Styleguide-local site settings.
 *
 * Only the fields consumed by the styleguide helpers (HeadWithDefaults,
 * withBase, composeMetaTitle, color-scheme bootstrap) are declared here.
 * Full zudo-doc site config (nav, footer, locales, …) lives in the root
 * package and is not needed for the standalone styleguide package.
 */

export interface ColorModeConfig {
  defaultMode: "light" | "dark";
  lightScheme: string;
  darkScheme: string;
  respectPrefersColorScheme?: boolean;
}

export const settings = {
  siteName: "Zudo Sg — Styleguide",
  base: "/" as string,
  trailingSlash: false as boolean,
  siteUrl: "" as string,
  colorScheme: "Default Dark" as string,
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } as ColorModeConfig | false,
  sidebarResizer: false as boolean,
  metaTags: {
    description: false as boolean,
    keywords: "" as string,
    ogImage: false as string | false,
    ogSiteName: false as boolean,
    twitterCard: false as string | false,
  },
};
