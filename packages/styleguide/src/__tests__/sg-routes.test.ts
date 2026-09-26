import { describe, expect, it } from "vitest";
import { DEFAULT_SG_ROUTES, isPreviewTokenPanelWired, isTokensRouteEnabled, previewCollisionSlug } from "../sg-routes.js";

describe("previewCollisionSlug — disabled", () => {
  it("returns null when the preview route is disabled, regardless of the configured pattern", () => {
    expect(previewCollisionSlug({ ...DEFAULT_SG_ROUTES }, { disabled: true })).toBeNull();
    expect(
      previewCollisionSlug({ componentsSlug: "/components/[slug]", componentsPreview: "/components/preview" }, { disabled: true }),
    ).toBeNull();
  });

  it("still detects the collision when not disabled (regression guard)", () => {
    expect(previewCollisionSlug({ ...DEFAULT_SG_ROUTES })).toBe("preview");
    expect(previewCollisionSlug({ ...DEFAULT_SG_ROUTES }, { disabled: false })).toBe("preview");
  });
});

describe("isTokensRouteEnabled", () => {
  it("an explicit string pattern always wins", () => {
    expect(isTokensRouteEnabled({ registryMode: "descriptor", tokensRouteOption: "/design-tokens", hasTokensManifest: false })).toBe(true);
    expect(isTokensRouteEnabled({ registryMode: "module", tokensRouteOption: "/design-tokens", hasTokensManifest: false })).toBe(true);
  });

  it("an explicit false always wins", () => {
    expect(isTokensRouteEnabled({ registryMode: "module", tokensRouteOption: false, hasTokensManifest: true })).toBe(false);
    expect(isTokensRouteEnabled({ registryMode: "descriptor", tokensRouteOption: false, hasTokensManifest: true })).toBe(false);
  });

  it("descriptor mode with no explicit option and no manifest is disabled", () => {
    expect(isTokensRouteEnabled({ registryMode: "descriptor", tokensRouteOption: undefined, hasTokensManifest: false })).toBe(false);
  });

  it("descriptor mode with no explicit option but a manifest stays enabled", () => {
    expect(isTokensRouteEnabled({ registryMode: "descriptor", tokensRouteOption: undefined, hasTokensManifest: true })).toBe(true);
  });

  it("module mode with no explicit option and no manifest stays enabled (narrowing is descriptor-only)", () => {
    expect(isTokensRouteEnabled({ registryMode: "module", tokensRouteOption: undefined, hasTokensManifest: false })).toBe(true);
  });
});

describe("isPreviewTokenPanelWired (#872)", () => {
  it("is wired when tabsModule is set", () => {
    expect(isPreviewTokenPanelWired({ tabsModule: "./src/config/preview-token-panel-tabs.ts" })).toBe(true);
  });

  it("is unwired when tabsModule is absent, empty, or zdtpApplyProxy itself is undefined", () => {
    expect(isPreviewTokenPanelWired({})).toBe(false);
    expect(isPreviewTokenPanelWired({ tabsModule: "" })).toBe(false);
    expect(isPreviewTokenPanelWired(undefined)).toBe(false);
  });
});
