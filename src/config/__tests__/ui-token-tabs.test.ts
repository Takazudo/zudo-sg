import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assertValidPanelConfig } from "@takazudo/zdtp/testing";

// The runtime config deliberately keeps these browser/dev-only dependencies
// outside the shared module. Mocking them lets this test inspect both configs
// while keeping the test itself a plain structural/data check.
vi.mock(
  "@/features/styleguide/token-tweak/preview-iframe-registry",
  () => ({
    applyPreviewVars: vi.fn(),
    clearPreviewVars: vi.fn(),
  }),
);
vi.mock("virtual:zdtp-apply-config", () => ({
  applyEndpoint: undefined,
  applyRouting: undefined,
}));

import { previewTokenPanelConfig } from "../preview-token-panel-config";
import {
  dashboardPreviewOverrides,
  UI_DASHBOARD_PREVIEW_TEXT,
  uiDashboardTabs,
  uiTokenTabs,
} from "../ui-token-tabs";
import {
  UI_COLOR_TOKENS,
  UI_FONT_TOKENS,
  UI_PALETTE_COLORS,
  UI_SIZE_TOKENS,
  UI_SPACING_TOKENS,
} from "../ui-design-tokens-manifest";

const MODULE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../ui-token-tabs.ts",
);

function allItems() {
  return uiTokenTabs.flatMap((tab) =>
    tab.tiers.flatMap((tier) => tier.items.map((item) => ({ tab, tier, item }))),
  );
}

function findTier(tabId: string, tierId: string) {
  const tab = uiTokenTabs.find(({ id }) => id === tabId);
  expect(tab, `missing tab ${tabId}`).toBeDefined();
  const tier = tab?.tiers.find(({ id }) => id === tierId);
  expect(tier, `missing tier ${tabId}/${tierId}`).toBeDefined();
  return tier!;
}

function expectManifestGroup(
  tabId: string,
  tokens: readonly { group: string; id: string; cssVar: string; default: string }[],
  groups: readonly string[],
) {
  for (const group of groups) {
    const expected = tokens
      .filter((token) => token.group === group)
      .map(({ id, cssVar, default: value }) => [id, cssVar, value]);
    expect(
      findTier(tabId, group).items.map(({ id, cssVar, default: value }) => [
        id,
        cssVar,
        value,
      ]),
      `${tabId}/${group} mapping`,
    ).toEqual(expected);
  }
}

describe("shared UI token tabs", () => {
  it("has only the build-safe generated manifest runtime import", () => {
    const source = readFileSync(MODULE_PATH, "utf8");
    const runtimeImports = [
      ...source.matchAll(
        /^\s*import(?!\s+type\b)[\s\S]*?\sfrom\s+["']([^"']+)["']/gm,
      ),
    ].map((match) => match[1]);

    // The explicit extension is required by Node's native type stripping;
    // normalize it when checking the contract's manifest-only allowlist.
    expect(runtimeImports.map((specifier) => specifier?.replace(/\.ts$/, ""))).toEqual([
      "./ui-design-tokens-manifest",
    ]);
    expect(source).not.toContain("virtual:");
    expect(source).not.toContain("preview-iframe-registry");
    expect(source).not.toContain("@/config/settings");
    expect(source).not.toContain("window.");
    expect(source).not.toContain("document.");
  });

  it("imports with plain Node's native type stripping", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(MODULE_PATH)}).then((module) => console.log(module.uiTokenTabs.length)).catch((error) => { console.error(error); process.exitCode = 1; })`,
      ],
      { cwd: resolve(dirname(MODULE_PATH), "../.."), encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("5");
  });

  it("preserves tab identity, order, palette grouping, and the 102 items", () => {
    expect(uiTokenTabs.map(({ id }) => id)).toEqual([
      "ui-color",
      "palette",
      "spacing",
      "font",
      "size",
    ]);
    expect(uiDashboardTabs).toBe(uiTokenTabs);
    expect(previewTokenPanelConfig.tabs).toBe(uiTokenTabs);
    expect(allItems()).toHaveLength(102);

    expect(uiTokenTabs.find(({ id }) => id === "palette")?.tiers.map(({ id }) => id)).toEqual([
      "palette-neutral",
      "palette-accent",
      "palette-state",
      "palette-line-vacuum",
      "palette-line-process",
      "palette-line-laser",
      "palette-line-meeting",
      "palette-line-beauty",
    ]);
  });

  it("passes the public panel validator with dashboard tabs", () => {
    const {
      storagePrefix,
      consoleNamespace,
      modalClassPrefix,
      schemaId,
      exportFilenameBase,
      toggleEvent,
      autoRememberOnOpen,
    } = previewTokenPanelConfig;
    expect(() =>
      assertValidPanelConfig({
        storagePrefix,
        consoleNamespace,
        modalClassPrefix,
        schemaId,
        exportFilenameBase,
        toggleEvent,
        autoRememberOnOpen,
        tabs: uiDashboardTabs,
        colorPresets: {},
        applySink: { apply() {}, clear() {} },
      }),
    ).not.toThrow();
  });

  it("maps each manifest group in manifest order", () => {
    expectManifestGroup("ui-color", UI_COLOR_TOKENS, [
      "surface",
      "text",
      "accent",
      "rail",
      "state",
    ]);
    expectManifestGroup("spacing", UI_SPACING_TOKENS, ["hsp", "vsp"]);
    expectManifestGroup("font", UI_FONT_TOKENS, [
      "font-size",
      "font-size-lh",
      "font-weight",
      "line-height",
      "font-family",
    ]);
    expectManifestGroup("size", UI_SIZE_TOKENS, ["radius", "shadow"]);

    const paletteItems = uiTokenTabs
      .find(({ id }) => id === "palette")!
      .tiers.flatMap(({ items }) => items)
      .map(({ id, cssVar, default: value }) => [id, cssVar, value]);
    expect(paletteItems).toEqual(
      UI_PALETTE_COLORS.map(({ name, value }) => [
        `palette-${name}`,
        `--palette-${name}`,
        value,
      ]),
    );
  });

  it("uses the manifest control and unit metadata for every item", () => {
    const manifestTokens = [
      ...UI_COLOR_TOKENS,
      ...UI_SPACING_TOKENS,
      ...UI_FONT_TOKENS,
      ...UI_SIZE_TOKENS,
    ];
    const itemsByCssVar = new Map(
      allItems().map(({ item }) => [item.cssVar, item]),
    );

    for (const token of manifestTokens) {
      const item = itemsByCssVar.get(token.cssVar);
      expect(item, `missing ${token.cssVar}`).toBeDefined();
      if (token.control === "select") {
        expect(item!.type).toEqual({ kind: "select", options: token.options ?? [] });
      } else if (token.control === "text") {
        expect(item!.type).toEqual({ kind: "text" });
      } else if (token.group === "font-size-lh" || token.group === "line-height") {
        expect(item!.type).toEqual({ kind: "number", step: token.step, unit: token.unit });
      } else {
        expect(item!.type).toEqual({ kind: "length", step: token.step, unit: token.unit });
      }
      expect(item!.label).toBe(token.label);
      expect(item!.default).toBe(token.default);
      if (token.pill) expect(item!.pill).toEqual(token.pill);
    }

    for (const paletteItem of allItems()
      .filter(({ tab }) => tab.id === "palette")
      .map(({ item }) => item)) {
      expect(paletteItem.type).toEqual({ kind: "color", format: "oklch" });
    }
  });

  it("declares previews, overrides, and valid preview bases", () => {
    expect(findTier("spacing", "hsp").preview).toBe("bar");
    expect(findTier("spacing", "vsp").preview).toBe("bar");
    expect(findTier("size", "radius").preview).toBe("radius");
    expect(findTier("size", "shadow").preview).toBeUndefined();
    expect(uiTokenTabs.find(({ id }) => id === "ui-color")?.tiers.every(({ preview }) => !preview)).toBe(true);
    expect(uiTokenTabs.find(({ id }) => id === "palette")?.tiers.every(({ preview }) => !preview)).toBe(true);

    expect(findTier("font", "font-size")).toMatchObject({ preview: "size" });
    expect(findTier("font", "font-size-lh")).toMatchObject({
      preview: "line-height",
      previewBase: "--text-base",
    });
    expect(findTier("font", "font-weight")).toMatchObject({ preview: "weight" });
    expect(findTier("font", "line-height")).toMatchObject({
      preview: "line-height",
      previewBase: "--text-base",
    });
    expect(findTier("font", "font-family")).toMatchObject({ preview: "family" });

    expect(Object.keys(dashboardPreviewOverrides)).toHaveLength(
      UI_COLOR_TOKENS.length + 3,
    );
    for (const token of UI_COLOR_TOKENS) {
      expect(dashboardPreviewOverrides[token.cssVar]).toBe("color");
    }
    for (const token of UI_SIZE_TOKENS.filter(({ group }) => group === "shadow")) {
      expect(dashboardPreviewOverrides[token.cssVar]).toBe("shadow");
    }

    const itemLocations = new Map(
      allItems().map(({ item, tier }) => [item.cssVar, tier]),
    );
    for (const cssVar of Object.keys(dashboardPreviewOverrides)) {
      expect(itemLocations.has(cssVar)).toBe(true);
      expect(itemLocations.get(cssVar)?.preview).toBeUndefined();
    }
    for (const tab of uiDashboardTabs) {
      for (const tier of tab.tiers) {
        if (tier.previewBase) {
          expect(
            tab.tiers.some((candidate) =>
              candidate.items.some(({ cssVar }) => cssVar === tier.previewBase),
            ),
          ).toBe(true);
        }
      }
    }
  });

  it("keeps a fixed bilingual two-paragraph specimen with digits", () => {
    expect(UI_DASHBOARD_PREVIEW_TEXT.split("\n\n")).toHaveLength(2);
    expect(UI_DASHBOARD_PREVIEW_TEXT).toMatch(/[A-Za-z]/);
    expect(UI_DASHBOARD_PREVIEW_TEXT).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
    expect(UI_DASHBOARD_PREVIEW_TEXT).toMatch(/\d/);
  });
});
