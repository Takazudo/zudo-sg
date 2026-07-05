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
  // Package-owned routes (#113): zudo-doc injects the docs / 404 / robots /
  // sitemap chrome routes; the host retired its hand-wired pages/lib/ doc-route
  // shells. The styleguide (/components/*), home (/), and /docs/versions stay
  // host-owned (zfb's route injection yields to a host page stub at the same
  // pattern — "Decision 6"). See docs/adr/route-injection-seam.md in zudo-doc.
  packageOwnedRoutes: true as boolean,
  // Host-callables channel for the injected routes: a module exporting
  // `chromeBindings: ChromeHostBindings`. Only the BodyEndIslands slot is
  // overridden (the two zdtp token panels + image/mermaid enlarge); every other
  // slot keeps its package default. Lives under pages/lib/ so it can import the
  // host BodyEndIslands island chain without dragging pages/* into the src tsc
  // program. See pages/lib/_chrome-bindings.tsx.
  chromeBindingsModule: "./pages/lib/_chrome-bindings.tsx" as string,
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
  // panel, not this project's real 4-tab panel. Instead a project-rendered
  // Design Tokens icon (the `type: "html"` item below) dispatches
  // "toggle-my-doc-tweak" — the doc-chrome panel's explicit toggle channel (see
  // design-token-panel-config.ts). The DesignTokenPanelBootstrap island
  // (body-end) listens for it. See Takazudo/zudo-sg#84/#85.
  //
  // #113: the icon MOVED here from `pages/lib/_header-with-defaults.tsx` so it
  // renders on the package-owned doc routes too — settings.headerRightItems is
  // serialized into the route-context, and the package Header renders `html`
  // items verbatim (filterHeaderRightItems passes them through unconditionally).
  // Keep it LAST so it trails theme-toggle/search, matching the prior push order.
  headerRightItems: [
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
    { type: "component", component: "language-switcher" },
    {
      type: "html",
      html:
        '<button id="my-doc-tweak-trigger" type="button" ' +
        'class="flex items-center justify-center text-muted transition-colors hover:text-fg cursor-pointer" ' +
        'aria-label="Open design tokens panel" title="Design tokens" ' +
        "onclick=\"window.dispatchEvent(new CustomEvent('toggle-my-doc-tweak'))\">" +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="4" y1="6" x2="20" y2="6"></line>' +
        '<line x1="4" y1="12" x2="20" y2="12"></line>' +
        '<line x1="4" y1="18" x2="20" y2="18"></line>' +
        '<circle cx="9" cy="6" r="2.4" fill="currentColor" stroke="none"></circle>' +
        '<circle cx="15" cy="12" r="2.4" fill="currentColor" stroke="none"></circle>' +
        '<circle cx="8" cy="18" r="2.4" fill="currentColor" stroke="none"></circle>' +
        "</svg></button>",
    },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
};
