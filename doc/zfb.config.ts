import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    port: 4323,
    siteName: "zudo-sg Docs",
    siteTreeNavSecondary: ["changelog", "claude", "claude-md", "claude-skills"],
    siteUrl: "https://zudo-sg-doc.takazudomodular.com",
    // Explicit since zudo-doc 5.17.0 gated /sitemap.xml on this setting; before that
    // the route was emitted unconditionally and this deployed site shipped one.
    sitemap: true,
    base: "/",
    entryDocSlug: "getting-started",
    llmsTxt: true,
    imageEnlarge: true,
    dynamicPageTransition: true,
    claudeResources: {
      claudeDir: "../.claude",
      scanRoot: "..",
    },
    defaultLocaleOnlyPrefixes: [
      "/docs/claude-md/",
      "/docs/claude-skills/",
      "/docs/claude-agents/",
      "/docs/claude-commands/",
    ],
    // Package release history for the published engine (@takazudo/zudo-sg).
    // The postBuild `changelog` plugin regenerates packages/styleguide/CHANGELOG.md
    // from these MDX pages every `pnpm build:doc` — outputFile resolves against
    // this workspace's projectRoot (doc/), so the "../" climbs back to the repo
    // root. #668's /l-make-release run appends the next version's entry here.
    changelogs: [
      {
        sourceDir: "src/content/docs/changelog/zudo-sg",
        outputFile: "../packages/styleguide/CHANGELOG.md",
        packageName: "@takazudo/zudo-sg",
      },
    ],
    headerNav: [
      {
        label: "Getting Started",
        path: "/docs/getting-started",
        categoryMatch: "getting-started",
      },
      {
        label: "Architecture",
        path: "/docs/architecture",
        categoryMatch: "architecture",
      },
      {
        label: "Development",
        path: "/docs/development",
        categoryMatch: "development",
      },
      {
        label: "Reference",
        path: "/docs/reference",
        categoryMatch: "reference",
      },
      {
        label: "Changelog",
        path: "/docs/changelog",
        categoryMatch: "changelog",
      },
    ],
    headerRightItems: [
      { type: "component", component: "github-link" },
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "search" },
    ],
    strictContentBridge: true,
  }),
);
