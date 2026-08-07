import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    port: 4323,
    siteName: "Zudo Sg Docs",
    siteUrl: "https://zudo-sg-doc.takazudomodular.com",
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
    ],
    headerRightItems: [
      { type: "component", component: "github-link" },
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "search" },
    ],
    strictContentBridge: true,
  }),
);
