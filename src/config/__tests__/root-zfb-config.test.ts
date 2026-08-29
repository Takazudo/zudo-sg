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
      "doc/src/content/docs",
    ]);
  });

  it("keeps preset plugins first and appends the token-panel proxy", () => {
    expect(config.plugins?.map(({ name }) => name)).toEqual([
      "@takazudo/zudo-doc/plugins/routes",
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-doc/plugins/theme-packs",
      "@takazudo/zudo-doc/plugins/llms-txt",
      "./plugins/zdtp-apply-proxy-plugin.mjs",
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
      exclude: ["apps/demo/**"],
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
      logo: "/img/logo.svg",
      entryDocSlug: "guide",
      tocToggle: false,
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
