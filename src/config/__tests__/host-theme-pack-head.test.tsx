/** @jsxRuntime automatic */
// Host-owned routes (`/`, `/docs/versions`) render through
// `pages/lib/_head-with-defaults.tsx` + `DocLayoutWithDefaults`. The package
// doc routes stamp `data-theme-pack` and the pack stylesheet in that same
// SSR output. This renders the host head the build uses and asserts the
// configured pack (settings.themePack "default" → Graphite) is present
// before any client navigation.

import { renderToString } from "@takazudo/zfb/zudo-react/server";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("virtual:zudo-doc-route-context", () => ({
  routeContext: {
    settings: {
      themePack: "default",
      colorMode: {
        defaultMode: "dark",
        lightScheme: "Default Light",
        darkScheme: "Default Dark",
        respectPrefersColorScheme: true,
      },
      colorScheme: "Default Dark",
      siteName: "zudo-sg",
      siteUrl: "",
      siteDescription: "",
      base: "/",
      trailingSlash: false,
      defaultLocale: "en",
      locales: {},
      docsDir: "src/content/docs",
      headerNav: [],
      tocMinDepth: 2,
      tocMaxDepth: 4,
      tagVocabulary: false,
      tagGovernance: "off",
      versions: [],
      metaTags: {
        description: true,
        keywords: "",
        ogImage: false,
        ogSiteName: true,
        twitterCard: "summary",
        twitterCreator: "@Takazudo",
      },
      sidebarResizer: true,
      llmsTxt: true,
      noindex: false,
    },
    colorSchemes: null,
    translations: { en: {} },
    homeIntros: {},
    tagVocabulary: [],
    assetManifest: null,
    themePackRegistry: [
      { slug: "classic", meta: { version: "0.0.0" }, hasStylesheet: false },
      { slug: "graphite", meta: { version: "1.0.0" }, hasStylesheet: true },
    ],
  },
}));

const testGlobal = globalThis as unknown as { __zfb?: Record<string, unknown> };
const previousZfb = testGlobal.__zfb;

beforeEach(() => {
  testGlobal.__zfb = {
    ...previousZfb,
    zudoReactBuild: "host-theme-pack-test",
    zudoReactIslands: ["ThemeToggle"],
  };
});

afterEach(() => {
  testGlobal.__zfb = previousZfb;
});

describe("host HeadWithDefaults theme-pack SSR", () => {
  it("server-renders data-theme-pack=graphite and the pack stylesheet", async () => {
    const { HeadWithDefaults, themePackSsrSlug } = await import(
      "../../../pages/lib/_head-with-defaults"
    );

    expect(themePackSsrSlug).toBe("graphite");

    const html = renderToString(
      <DocLayoutWithDefaults
        title="zudo-sg"
        head={<HeadWithDefaults title="zudo-sg" />}
        dataThemePack={themePackSsrSlug}
        lang="en"
        hideSidebar
        hideToc
        sidebarOverride={<></>}
        headerOverride={<header />}
      >
        <p>home</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).toMatch(/<html[^>]* data-theme-pack="graphite"/);
    expect(html).toContain('href="/theme-packs/graphite/pack.css?v=1.0.0"');
    expect(html).toContain('KEY="zudo-doc-theme-pack"');
  });
});
