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
  Settings,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig as ColorModeConfig | false,
  // --- Branding (#194) ----------------------------------------------------
  // Site identity fields, kept contiguous. Two more identity fields live
  // elsewhere in this file (metaTags.twitterCreator, footer.copyright)
  // because they're typed as part of MetaTagsConfig / FooterConfig —
  // externally defined by @takazudo/zudo-doc — and can't be physically
  // relocated here without restructuring those package types. Each carries
  // a cross-reference comment pointing back to this block.
  siteName: "zudo-sg",
  logo: "auto",
  // Falsy siteUrl silently omits OGP absolute image URLs and canonical link
  // tags from build output — see the module-load warning below.
  siteUrl: "" as string,
  // -------------------------------------------------------------------------
  siteDescription:
    "A zudo-doc-based styleguide host and provider of the @zudo-sg/demo-ui component library.",
  base: "/",
  trailingSlash: false as boolean,
  noindex: false as boolean,
  editUrl: false as string | false,
  githubUrl: false as string | false,
  home: {
    wide: true,
    introMarkdown: `zudo-sg is a zudo-doc-based styleguide host and the provider of the @zudo-sg/demo-ui component library.

A live design-token panel, reachable from the header's tokens icon, lets you tune the component previews.

The same library drives a multi-page demo site, so the components can be explored in both a styleguide and a complete product experience.

- [Overview](/docs/overview) — Learn what zudo-sg provides.
- [Components](/components) — Browse the @zudo-sg/demo-ui component catalog.
- [Design Tokens](/tokens) — Explore and tune the shared design tokens.`,
    sitemapHeading: "",
  },
  metaTags: {
    description: true,
    keywords: "",
    ogImage: "/img/ogp.png",
    ogSiteName: true,
    twitterCard: "summary",
    // Branding identity field (#194) — kept here because MetaTagsConfig is
    // externally typed by @takazudo/zudo-doc; see the Branding block above.
    twitterCreator: "@Takazudo",
  } satisfies MetaTagsConfig as MetaTagsConfig,
  docsDir: "src/content/docs",
  entryDocSlug: "overview",
  defaultLocale: "en" as const,
  locales: {} as Record<string, LocaleConfig>,
  mermaid: true,
  // Package default for an opt-in feature not enabled here.
  transclude: false as boolean,
  sitemap: false,
  docTags: false,
  docMetainfo: true,
  tagPlacement: "after-title" as TagPlacement,
  tagGovernance: "off" as TagGovernanceMode,
  tagVocabulary: false as boolean,
  frontmatterPreview: false as FrontmatterPreviewConfig | false,
  llmsTxt: true,
  changelogs: false,
  math: false,
  cjkFriendly: true as boolean,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  // Package-owned routes (#113): zudo-doc injects the docs / 404 / robots /
  // sitemap chrome routes; the host retired its hand-wired pages/lib/ doc-route
  // shells. The styleguide (/components/*), home (/), and /docs/versions stay
  // host-owned (zfb's route injection yields to a host page stub at the same
  // pattern — "Decision 6"). See docs/adr/route-injection-seam.md in zudo-doc.
  packageOwnedRoutes: true as boolean,
  dynamicPageTransition: true as boolean,
  // Host-callables channel for the injected routes: a module exporting
  // `chromeBindings: ChromeHostBindings`. Binds BodyEndIslands (the preview
  // zdtp token panel + image/mermaid enlarge) and docHistoryMeta (Created /
  // Updated / Author); every other slot keeps its package default. Lives under pages/lib/
  // so it can import the host BodyEndIslands island chain without dragging
  // pages/* into the src tsc program. See pages/lib/_chrome-bindings.tsx.
  chromeBindingsModule: "./pages/lib/_chrome-bindings.tsx" as string,
  aiAssistant: false as boolean,
  aiChatDemoMode: false as boolean,
  aiChatAllowedOrigins: [] as string[],
  aiChatGlobalDailyLimit: false as number | false,
  // Off by default and deliberately: the doc-chrome token panel was a
  // host-only extra this site mounted for itself, which `create-zudo-sg`
  // never scaffolds. Keeping it here made the dogfooding host advertise a
  // feature adopters do not get. The PREVIEW token panel (engine-provided;
  // mounted by pages/lib/_body-end-islands.tsx via
  // `@takazudo/zudo-sg/token-tweak/preview-token-panel-bootstrap`, and kept
  // loadable by `bundleZdtp: true` in zfb.config.ts) and the `/tokens`
  // dashboard are unaffected.
  designTokenPanel: false as boolean,
  tocMinDepth: 2 as number,
  tocMaxDepth: 4 as number,
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  tocToggle: true as boolean,
  imageEnlarge: true as boolean,
  // Package default for an opt-in feature not enabled here.
  assetViewer: false as boolean,
  // Package default for an opt-in feature not enabled here.
  assetViewerDir: "assets",
  // Package default for an opt-in feature not enabled here.
  assetViewerRoutePrefix: "files",
  // Package default for an opt-in feature not enabled here.
  assetViewerExclude: [] as string[],
  // Package default for an opt-in feature not enabled here.
  assetViewerIndex: false as boolean,
  // Package default for an opt-in feature not enabled here.
  assetViewerIndexing: false as false,
  findInPage: false as boolean,
  docHistory: true as boolean,
  docHistoryUi: false,
  docHistoryExclude: [] as string[],
  bodyFootUtilArea: false as false,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: [] satisfies VersionConfig[] as VersionConfig[] | false,
  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,
  codexResources: false as { codexDir: string; projectRoot?: string } | false,
  defaultLocaleOnlyPrefixes: [] as string[],
  footer: {
    links: [],
    // Branding identity field (#194) — kept here because FooterConfig is
    // externally typed by @takazudo/zudo-doc; see the Branding block above.
    copyright: `Copyright © ${new Date().getFullYear()} <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="https://zudo-doc.takazudomodular.com/">zudo-doc</a>. Enjoy synth on <a href="https://takazudomodular.com/">Takazudo Modular</a>.`,
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Overview", path: "/docs/overview", categoryMatch: "overview" },
    { label: "Architecture", path: "/docs/architecture", categoryMatch: "architecture" },
    { label: "Components", path: "/components", categoryMatch: "components" },
    { label: "Design Tokens", path: "/tokens" },
  ] satisfies HeaderNavItem[] as HeaderNavItem[],
  // #113: headerRightItems is serialized into the route-context so these
  // render on the package-owned doc routes too, not just host pages.
  headerRightItems: [
    { type: "component", component: "github-link" },
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
    { type: "component", component: "language-switcher" },
  ] satisfies HeaderRightItem[] as HeaderRightItem[],
} satisfies Settings;

// #194: siteUrl backs OGP absolute image URLs and canonical link tags.
// Warn at module load (i.e. at build time) so a missing value doesn't ship
// unnoticed.
if (!settings.siteUrl) {
  console.warn(
    "[settings] siteUrl is not set — OGP meta tags and canonical absolute URLs will be omitted from the build output.",
  );
}
