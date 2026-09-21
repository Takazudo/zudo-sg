import { describe, expect, it } from "vitest";

import config from "../../../zfb.config";
import { settings } from "../settings";

describe("root zfb integration contract", () => {
  it("keeps the advanced preset collections and appends component docs once", () => {
    expect(config.collections?.map(({ name }) => name)).toEqual([
      "docs",
      "componentDocs",
    ]);
    expect(config.resolveMarkdownLinks?.dirs.map(({ dir }) => dir)).toEqual([
      "src/content/docs",
    ]);
  });

  it("keeps metadata serialization after preset history and appends the zudo-sg engine plugins last", () => {
    expect(config.plugins?.map(({ name }) => name)).toEqual([
      "@takazudo/zudo-doc/plugins/routes",
      "@takazudo/zudo-doc/plugins/doc-history",
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-doc/plugins/theme-packs",
      "@takazudo/zudo-doc/plugins/llms-txt",
      "@takazudo/zudo-doc/plugins/img-src-check",
      // bundleZdtp keeps the throwing zdtp-loader stub out of the host build
      // even though designTokenPanel is off (the preview panel needs the loader).
      "./pages/lib/_doc-history-meta.mjs",
      "@takazudo/zudo-sg/plugins/routes",
      "@takazudo/zudo-sg/plugins/preview-css",
      "@takazudo/zudo-sg/plugins/zdtp-apply-proxy",
    ]);
  });

  it("enables the strict bridge and relies on zfb native public copying", () => {
    expect(config.strictContentBridge).toBe(true);
    expect(config.base).toBe("/");
    expect(config.publicDir).toBeUndefined();
    expect(config.copyPublicWithBase).toBeUndefined();
    expect(config.plugins?.some(({ name }) => name.includes("copy-public"))).toBe(
      false,
    );
  });

  it("keeps the root bundle boundary and image dimensions enabled", () => {
    expect(config.bundle).toEqual({
      exclude: ["apps/demo/**", "doc/**"],
      mainFields: ["main", "module"],
    });
    expect(config.markdown?.features?.imageDimensions).toEqual({});
  });

  it("passes the complete host settings through the route descriptor, header token trigger included", () => {
    const routes = config.plugins?.find(
      ({ name }) => name === "@takazudo/zudo-doc/plugins/routes",
    );
    const routeSettings = routes?.options?.settings as
      | { headerRightItems?: unknown[] }
      | undefined;

    // The trigger (#813/#816) is listed in src/config/settings.ts itself, so
    // `pages/index.tsx`'s own header carries it too — see the comment there.
    // withZudoSg() therefore finds it already installed and appends nothing,
    // and the route descriptor is the host settings byte-for-byte again.
    expect(routeSettings).toEqual({ ...settings, bundleZdtp: true });

    const triggers = (settings.headerRightItems as Array<{ type: string; html?: string }>).filter(
      (item) => item.type === "html" && item.html?.includes("sg-preview-tokens-trigger"),
    );
    expect(triggers).toHaveLength(1);

    expect(settings).toMatchObject({
      // The doc-chrome token panel is gone; only the engine's preview panel
      // and the /tokens dashboard remain, so the preset must NOT mount
      // zudo-doc's own panel — while `bundleZdtp` above keeps the real
      // zdtp loader in the build for the preview panel.
      designTokenPanel: false,
      logo: "auto",
      entryDocSlug: "overview",
      tocToggle: true,
      versions: [],
    });
  });

  it("keeps the zudo-doc 5 task-list and footnote defaults", () => {
    expect(config.markdown?.gfm).toEqual({
      taskListItem: true,
      footnoteDefinition: true,
    });
  });
});
