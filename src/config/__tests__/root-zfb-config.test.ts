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

  it("passes the complete host settings through the route descriptor, plus the header token trigger", () => {
    const routes = config.plugins?.find(
      ({ name }) => name === "@takazudo/zudo-doc/plugins/routes",
    );
    const routeSettings = routes?.options?.settings as
      | { headerRightItems?: unknown[] }
      | undefined;

    // withZudoSg()'s headerTokenTrigger option (#813/#816, default true) is
    // unconditional, so it appends one `{ type: "html" }` header-right item
    // carrying the "sg-preview-tokens-trigger" button to this exact settings
    // object — the field this test otherwise asserts is passed through
    // byte-for-byte. Assert everything else is unchanged, then assert the
    // one appended entry separately.
    const { headerRightItems: routeHeaderRightItems, ...routeRest } =
      routeSettings ?? {};
    const { headerRightItems: baseHeaderRightItems, ...baseRest } = settings;

    expect(routeRest).toEqual({ ...baseRest, bundleZdtp: true });
    expect(routeHeaderRightItems?.slice(0, -1)).toEqual(baseHeaderRightItems);

    const trigger = routeHeaderRightItems?.at(-1) as
      | { type?: string; html?: string }
      | undefined;
    expect(trigger?.type).toBe("html");
    expect(trigger?.html).toContain("sg-preview-tokens-trigger");

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
