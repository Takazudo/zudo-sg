export type {
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  TagVocabularyEntry,
  MetaTagsConfig,
} from "./settings-types";
import type {
  HeaderNavItem,
  HeaderRightItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
  FrontmatterPreviewConfig,
  BodyFootUtilAreaConfig,
  TagPlacement,
  TagGovernanceMode,
  MetaTagsConfig,
} from "./settings-types";

const docsCategoryPath = (category: string): string => `/docs/${category}`;

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  // --- Branding (#194) ----------------------------------------------------
  // Site identity fields, kept contiguous (mirrors the root settings.ts
  // Branding block). This workspace has no twitterCreator (twitterCard is
  // disabled below) and no copyright (footer is disabled below) — both stay
  // intentionally absent rather than added as placeholders.
  siteName: "Zudo Sg Docs",
  // Falsy siteUrl silently omits OGP absolute image URLs and canonical link
  // tags from build output — see the module-load warning below. Inert here:
  // siteUrl is set.
  siteUrl: "https://zudo-sg-doc.takazudomodular.com" as string,
  // -------------------------------------------------------------------------
  siteDescription: "" as string,
  base: "/",
  trailingSlash: false as boolean,
  minifyHtml: true as boolean,
  noindex: false as boolean,
  editUrl: false as string | false,
  githubUrl: false as string | false,
  metaTags: {
    description: true,
    keywords: false,
    ogImage: false,
    ogSiteName: true,
    twitterCard: false,
  } satisfies MetaTagsConfig as MetaTagsConfig,
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {} as Record<string, LocaleConfig>,
  mermaid: true,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  tagPlacement: "after-title" as TagPlacement,
  tagGovernance: "off" as TagGovernanceMode,
  tagVocabulary: false as boolean,
  frontmatterPreview: false as FrontmatterPreviewConfig | false,
  llmsTxt: true,
  changelogs: false as false,
  math: false,
  cjkFriendly: false as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  aiAssistant: false as boolean,
  aiChatDemoMode: false as boolean,
  aiChatAllowedOrigins: [] as string[],
  aiChatGlobalDailyLimit: false as number | false,
  docHistory: false,
  packageOwnedRoutes: true,
  bodyFootUtilArea: false as BodyFootUtilAreaConfig | false,
  designTokenPanel: false as boolean,
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  headingIdStrategy: "hierarchical" as "flat" | "hierarchical",
  sidebarResizer: false as boolean,
  sidebarToggle: false as boolean,
  imageEnlarge: true as boolean,
  dynamicPageTransition: true as boolean,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: false as VersionConfig[] | false,
  claudeResources: {
    claudeDir: "../.claude",
    scanRoot: "..",
  } as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [
    "/docs/claude-md/",
    "/docs/claude-skills/",
    "/docs/claude-agents/",
    "/docs/claude-commands/",
  ] as string[],
  footer: false as FooterConfig | false,
  headerNav: [
    { label: "Getting Started", path: docsCategoryPath("getting-started"), categoryMatch: "getting-started" },
    { label: "Architecture", path: docsCategoryPath("architecture"), categoryMatch: "architecture" },
    { label: "Development", path: docsCategoryPath("development"), categoryMatch: "development" },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  headerRightItems: [
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
};

// #194: siteUrl backs OGP absolute image URLs and canonical link tags.
// Warn at module load (i.e. at build time) so a missing value doesn't ship
// unnoticed. Same guard shape as the root settings.ts; inert today since
// siteUrl is set above.
if (!settings.siteUrl) {
  console.warn(
    "[settings] siteUrl is not set — OGP meta tags and canonical absolute URLs will be omitted from the build output.",
  );
}
