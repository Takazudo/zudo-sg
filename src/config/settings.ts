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
  TagPlacement,
  TagGovernanceMode,
  MetaTagsConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  siteName: "Zudo Sg",
  siteDescription: "" as string,
  base: "/",
  trailingSlash: false as boolean,
  noindex: false as boolean,
  editUrl: false as string | false,
  githubUrl: false as string | false,
  siteUrl: "" as string,
  metaTags: {
    description: true,
    keywords: "",
    ogImage: "/img/ogp.png",
    ogSiteName: true,
    twitterCard: "summary",
    twitterCreator: "@Takazudo",
  } satisfies MetaTagsConfig as MetaTagsConfig,
  docsDir: "src/content/docs",
  defaultLocale: "en" as const,
  locales: {} as Record<string, LocaleConfig>,
  mermaid: true,
  sitemap: false,
  docTags: false,
  tagPlacement: "after-title" as TagPlacement,
  tagGovernance: "off" as TagGovernanceMode,
  tagVocabulary: false as boolean,
  frontmatterPreview: false as FrontmatterPreviewConfig | false,
  llmsTxt: true,
  math: false,
  cjkFriendly: true as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  // zudo-doc 2.x defaults packageOwnedRoutes to true; this repo still
  // hand-wires its doc routes in pages/lib/ (migration tracked in #113), so
  // stay off until that migration lands.
  packageOwnedRoutes: false as boolean,
  aiAssistant: false as boolean,
  aiChatDemoMode: false as boolean,
  aiChatAllowedOrigins: [] as string[],
  aiChatGlobalDailyLimit: false as number | false,
  designTokenPanel: true as boolean,
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  headingIdStrategy: "hierarchical" as "flat" | "hierarchical",
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  imageEnlarge: true as boolean,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: [] satisfies VersionConfig[] as VersionConfig[] | false,
  claudeResources: {
    claudeDir: ".claude",
  } as { claudeDir: string; projectRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [
    "/docs/claude-md/",
    "/docs/claude-skills/",
    "/docs/claude-agents/",
    "/docs/claude-commands/",
  ] as string[],
  footer: {
    links: [
      {
        title: "Docs",
        items: [
          { label: "Getting Started", href: "/docs/getting-started" },
        ],
      },
    ],
    copyright: "Copyright © 2026 Your Name. Built with zudo-doc.",
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },
    { label: "Components", path: "/components", categoryMatch: "components" },
    { label: "Changelog", path: "/docs/changelog", categoryMatch: "changelog" },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  // NOTE: the framework's native `{ type: "trigger", trigger: "design-token-panel" }`
  // is intentionally NOT listed here. In @takazudo/zdtp 0.3.0 that trigger
  // dispatches the RESERVED "toggle-design-token-panel" event, which is bound
  // only to the framework's empty-tabs default instance — so it opens an EMPTY
  // panel, not this project's real 4-tab panel. Instead, a project-rendered
  // Design Tokens icon (dispatching "toggle-my-doc-tweak") is injected into the
  // header right region by `pages/lib/_header-with-defaults.tsx`. See
  // Takazudo/zudo-sg#84/#85.
  headerRightItems: [
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
    { type: "component", component: "language-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
};
