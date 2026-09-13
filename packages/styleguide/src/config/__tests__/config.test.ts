import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PREVIEW_CSS_PLUGIN_NAME,
  ROUTES_PLUGIN_NAME,
  ZDTP_APPLY_PROXY_PLUGIN_NAME,
  withZudoSg,
  zudoSg,
  type ZudoSgComposeOptions,
} from "../index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const OPTIONS: ZudoSgComposeOptions = {
  componentsRoots: [
    { dir: "packages/demo-ui/src", importBase: "@zudo-sg/demo-ui/src" },
    { dir: "packages/extra/src", importBase: "@zudo-sg/extra/src" },
  ],
  registryOut: "./src/styleguide/sg-registry.ts",
  categoryOrder: ["Actions", "Forms"],
  uiPackageName: "@zudo-sg/demo-ui",
  barrelIndex: "packages/demo-ui/src/index.ts",
  tokens: { cssFiles: ["a.css", "b.css"], manifestOut: "./src/config/ui-design-tokens-manifest.ts" },
  previewStyles: "./src/styles/preview-entry.css",
  catalog: { title: "Catalog" },
  zdtpApplyProxy: {
    routingFile: "./zdtp-panel-routing.json",
    writeRoot: "./packages/demo-ui/styles",
    tabsModule: "./src/config/preview-token-panel-tabs.ts",
  },
};

describe("zudoSg()", () => {
  it("omits tokensManifestModule when the config has no tokens entry", () => {
    const { tokens: _tokens, ...withoutTokens } = OPTIONS;
    const { plugins } = zudoSg(withoutTokens);
    expect(plugins[0]?.name).toBe(ROUTES_PLUGIN_NAME);
    expect(plugins[0]?.options).not.toHaveProperty("tokensManifestModule");
  });

  it("returns the three engine plugin descriptors in order, with the ADR option shapes", () => {
    const { plugins } = zudoSg(OPTIONS);
    expect(plugins).toEqual([
      {
        name: ROUTES_PLUGIN_NAME,
        options: {
          registryModule: "./src/styleguide/sg-registry.ts",
          categoryOrder: ["Actions", "Forms"],
          uiPackageName: "@zudo-sg/demo-ui",
          previewCssUrl: "/_zudo-sg/preview.css",
          catalog: { title: "Catalog" },
          tokensManifestModule: "./src/config/ui-design-tokens-manifest.ts",
          componentDocs: [
            { keyPrefix: "demo-ui/src", collection: "componentDocs" },
            { keyPrefix: "extra/src", collection: "componentDocs1" },
          ],
        },
      },
      {
        name: PREVIEW_CSS_PLUGIN_NAME,
        options: { previewStyles: "./src/styles/preview-entry.css", previewCssUrl: "/_zudo-sg/preview.css" },
      },
      {
        name: ZDTP_APPLY_PROXY_PLUGIN_NAME,
        options: {
          routingFile: "./zdtp-panel-routing.json",
          writeRoot: "./packages/demo-ui/styles",
          tabsModule: "./src/config/preview-token-panel-tabs.ts",
        },
      },
    ]);
    expect(plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-sg/plugins/routes",
      "@takazudo/zudo-sg/plugins/preview-css",
      "@takazudo/zudo-sg/plugins/zdtp-apply-proxy",
    ]);
  });

  it("threads a custom previewCssUrl and routes into both consumers", () => {
    const { plugins } = zudoSg({ ...OPTIONS, previewCssUrl: "/x/preview.css", routes: { tokens: "/design" } });
    expect(plugins[0]?.options).toMatchObject({ previewCssUrl: "/x/preview.css", routes: { tokens: "/design" } });
    expect(plugins[1]?.options).toEqual({
      previewStyles: "./src/styles/preview-entry.css",
      previewCssUrl: "/x/preview.css",
    });
  });

  it("lists the zdtp plugin with empty (disabled) options when zdtpApplyProxy is omitted", () => {
    const { zdtpApplyProxy: _omit, ...rest } = OPTIONS;
    expect(zudoSg(rest).plugins[2]).toEqual({ name: ZDTP_APPLY_PROXY_PLUGIN_NAME, options: {} });
  });

  it("registers one componentDocs collection per components root", () => {
    expect(zudoSg(OPTIONS).collections).toEqual([
      { name: "componentDocs", path: "packages/demo-ui/src", include: ["**/*.mdx"] },
      { name: "componentDocs1", path: "packages/extra/src", include: ["**/*.mdx"] },
    ]);
  });

  it("is JSON-serializable data (bare-specifier descriptors, no functions)", () => {
    const fragment = zudoSg(OPTIONS);
    expect(JSON.parse(JSON.stringify(fragment))).toEqual(fragment);
  });
});

describe("withZudoSg()", () => {
  const preset = {
    collections: [{ name: "docs", path: "src/content/docs", schema: {} }],
    plugins: [
      { name: "@takazudo/zudo-doc/plugins/routes", options: { settings: {} } },
      { name: "@takazudo/zudo-doc/plugins/search-index" },
    ],
    markdown: { features: {} },
    trailingSlash: false,
  };

  it("keeps the preset's plugins and collections and appends the engine's AFTER them", () => {
    const merged = withZudoSg(preset, OPTIONS);
    expect(merged.plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-doc/plugins/routes",
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-sg/plugins/routes",
      "@takazudo/zudo-sg/plugins/preview-css",
      "@takazudo/zudo-sg/plugins/zdtp-apply-proxy",
    ]);
    expect(merged.collections.map((c) => c.name)).toEqual(["docs", "componentDocs", "componentDocs1"]);
    expect(merged.markdown).toBe(preset.markdown);
    expect(merged.trailingSlash).toBe(false);
    // The preset fragment itself is not mutated.
    expect(preset.plugins).toHaveLength(2);
  });
});

describe("config module purity", () => {
  it("has no node: imports (zfb evaluates configs node-free)", () => {
    const source = readFileSync(resolve(HERE, "../index.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']node:/);
    expect(source).not.toMatch(/import\s*\(\s*["']node:/);
  });
});
