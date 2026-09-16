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
      // NOT "@takazudo/zudo-doc/plugins/zdtp-loader" (#719): the preset injects
      // it whenever the *preset-facing* designTokenPanel is off — which it is
      // here, since zfb.config.ts's `presetSettings` forces it false to keep
      // package-owned routes from mounting a second panel (see test below,
      // "passes the complete host settings..."). That plugin shadows the panel
      // bootstrap's lazy `@takazudo/zudo-doc/zdtp-loader` import with a
      // throwing stub, which would break this host's OWN two panels, so
      // zfb.config.ts filters it back out. Keep this list exact — it is what
      // catches the preset silently adding or dropping a plugin again.
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

  it("passes the complete host settings through the route descriptor", () => {
    const routes = config.plugins?.find(
      ({ name }) => name === "@takazudo/zudo-doc/plugins/routes",
    );
    const routeSettings = routes?.options?.settings;

    expect(routeSettings).toEqual({ ...settings, designTokenPanel: false });
    expect(settings).toMatchObject({
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
