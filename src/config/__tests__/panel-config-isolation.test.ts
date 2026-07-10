/**
 * Guard: the doc-chrome panel config and the preview panel config must carry
 * DISTINCT identifiers so both panels can coexist on the same page without
 * localStorage collisions, console-namespace conflicts, or toggle-event
 * cross-talk.
 *
 * This is a pure structural / data test — no DOM, no browser API needed.
 */

import { describe, expect, it, vi } from "vitest";

// Mock the preview-iframe-registry so the preview config module can import
// without pulling in browser-side preview bridge code.
vi.mock(
  "@/features/styleguide/token-tweak/preview-iframe-registry",
  () => ({
    applyPreviewVars: vi.fn(),
    clearPreviewVars: vi.fn(),
  }),
);

// Mock @takazudo/zdtp — the configurePanel call happens in bootstrap modules,
// not in config modules, so only the types/exports we directly use are needed.
vi.mock("@takazudo/zdtp", () => ({}));

// Mock @/config/settings and @/config/color-schemes to avoid pulling in
// additional zfb-dependent modules during config module evaluation.
vi.mock("@/config/settings", () => ({
  settings: {
    colorScheme: "Default Dark",
    colorMode: {
      defaultMode: "dark",
      lightScheme: "Default Light",
      darkScheme: "Default Dark",
    },
  },
}));
vi.mock("@/config/color-schemes", () => ({
  colorSchemes: {
    "Default Light": { map: { semantic: {} } },
    "Default Dark": { map: { semantic: {} } },
  },
}));
vi.mock("@/config/color-scheme-utils", () => ({
  STATE_ROLES: ["danger", "success", "warning", "info"],
  getActiveScheme: () => ({
    ramps: {
      base: ["#f8f8f8", "#bbb", "#777", "#333", "#111"],
      accent: ["#da9", "#b75", "#753"],
      state: {
        danger: "#d33",
        success: "#3a5",
        warning: "#c80",
        info: "#38c",
      },
    },
    map: { semantic: {} },
  }),
  buildSemanticTierItems: () => [
    {
      id: "bg",
      cssVar: "--zd-bg",
      label: "bg",
      default: "base:base-4",
      type: { kind: "color", format: "oklch" },
    },
    {
      id: "accent",
      cssVar: "--zd-accent",
      label: "accent",
      default: "accent:accent-1",
      type: { kind: "color", format: "oklch" },
    },
  ],
}));

// Mock the zfb-only virtual module (registered by
// plugins/zdtp-apply-proxy-plugin.mjs's `setup` hook) — only zfb's own
// bundler can resolve a "virtual:" specifier; vitest runs under plain Vite.
vi.mock("virtual:zdtp-apply-config", () => ({
  applyEndpoint: undefined,
  applyRouting: undefined,
}));

import { designTokenPanelConfig } from "../design-token-panel-config";
import { previewTokenPanelConfig } from "../preview-token-panel-config";

describe("panel config isolation", () => {
  it("storagePrefix values are distinct", () => {
    expect(designTokenPanelConfig.storagePrefix).toBe("sg-doc-tweak");
    expect(previewTokenPanelConfig.storagePrefix).toBe("sg-preview-tweak");
    expect(designTokenPanelConfig.storagePrefix).not.toBe(
      previewTokenPanelConfig.storagePrefix,
    );
  });

  it("consoleNamespace values are distinct", () => {
    expect(designTokenPanelConfig.consoleNamespace).toBe("sgDoc");
    expect(previewTokenPanelConfig.consoleNamespace).toBe("sgPreview");
    expect(designTokenPanelConfig.consoleNamespace).not.toBe(
      previewTokenPanelConfig.consoleNamespace,
    );
  });

  it("modalClassPrefix values are distinct", () => {
    expect(designTokenPanelConfig.modalClassPrefix).toBe(
      "sg-doc-design-token-panel-modal",
    );
    expect(previewTokenPanelConfig.modalClassPrefix).toBe(
      "sg-preview-design-token-panel-modal",
    );
    expect(designTokenPanelConfig.modalClassPrefix).not.toBe(
      previewTokenPanelConfig.modalClassPrefix,
    );
  });

  it("toggleEvent values are distinct (both panels use explicit, non-reserved channels)", () => {
    // The doc panel binds to an explicit prefix-derived channel rather than the
    // RESERVED default ("toggle-design-token-panel"). The explicit channel is
    // still required because this site mounts two zdtp instances on one page
    // and must keep their toggles isolated (Takazudo/zudo-sg#84/#85).
    expect(designTokenPanelConfig.toggleEvent).toBe("toggle-sg-doc-tweak");
    expect(previewTokenPanelConfig.toggleEvent).toBe(
      "toggle-preview-token-panel",
    );
    expect(designTokenPanelConfig.toggleEvent).not.toBe(
      previewTokenPanelConfig.toggleEvent,
    );
  });

  it("no template-placeholder ('my-doc'-prefixed) identifiers remain", () => {
    const values = [
      designTokenPanelConfig.storagePrefix,
      designTokenPanelConfig.consoleNamespace,
      designTokenPanelConfig.modalClassPrefix,
      designTokenPanelConfig.toggleEvent,
      designTokenPanelConfig.exportFilenameBase,
    ];
    for (const value of values) {
      expect(value?.toLowerCase()).not.toContain("my-doc");
      expect(value?.toLowerCase()).not.toContain("mydoc");
    }
  });

  it("doc panel exposes ramp palette tiers and semantic ramp references", () => {
    expect(designTokenPanelConfig.colorPresets).toBeUndefined();

    const paletteTab = designTokenPanelConfig.tabs.find((t) => t.id === "palette");
    expect(paletteTab).toBeDefined();
    expect(paletteTab?.colorExtras).toBeUndefined();
    expect(paletteTab?.tiers.map((t) => t.id)).toEqual(["base", "accent", "state"]);
    expect(paletteTab?.tiers[0]?.items.map((item) => item.id)).toEqual([
      "base-0",
      "base-1",
      "base-2",
      "base-3",
      "base-4",
    ]);
    expect(paletteTab?.tiers[1]?.items.map((item) => item.id)).toEqual([
      "accent-0",
      "accent-1",
      "accent-2",
    ]);
    expect(paletteTab?.tiers[2]?.items.map((item) => item.id)).toEqual([
      "state-danger",
      "state-success",
      "state-warning",
      "state-info",
    ]);

    const colorTab = designTokenPanelConfig.tabs.find((t) => t.id === "color");
    const semanticTier = colorTab?.tiers.find((t) => t.id === "semantic");
    expect(semanticTier?.semantic).toBe(true);
    expect(semanticTier?.referencesRamps).toEqual([
      { tab: "palette", tier: "base" },
      { tab: "palette", tier: "accent" },
      { tab: "palette", tier: "state" },
    ]);
    expect(colorTab?.colorExtras?.colorSchemes).toEqual({});
    expect(colorTab?.colorExtras?.baseRoles).toEqual({});
  });

  it("preview panel has a reserved 'palette' tab grouping families, separate from the 'ui-color' tab", () => {
    const paletteTab = previewTokenPanelConfig.tabs.find((t) => t.id === "palette");
    expect(paletteTab).toBeDefined();
    // Reserved-tab contract (zdtp 0.4.0): a 'palette' tab MUST omit
    // colorExtras — multiple `{ kind: "color" }` tiers are only safe together
    // when no cluster is resolved from the tab.
    expect(paletteTab?.colorExtras).toBeUndefined();

    // One TierConfig per --palette-{group}-{step-or-role} group (base/accent/
    // state), matching UI_PALETTE_COLORS in ui-design-tokens-manifest.ts —
    // NOT one flat tier, since the curve editor derives every step in a tier
    // from one shared curve.
    const tierIds = paletteTab?.tiers.map((t) => t.id).sort();
    expect(tierIds).toEqual(
      ["palette-accent", "palette-base", "palette-state"].sort(),
    );
    const totalItems = paletteTab?.tiers.reduce((n, t) => n + t.items.length, 0);
    expect(totalItems).toBe(12);
    const baseTier = paletteTab?.tiers.find((t) => t.id === "palette-base");
    expect(baseTier?.items.map((item) => item.id)).toEqual([
      "palette-base-0",
      "palette-base-1",
      "palette-base-2",
      "palette-base-3",
      "palette-base-4",
    ]);
    expect(baseTier?.items.map((item) => item.cssVar)).toEqual([
      "--palette-base-0",
      "--palette-base-1",
      "--palette-base-2",
      "--palette-base-3",
      "--palette-base-4",
    ]);
    const stateTier = paletteTab?.tiers.find((t) => t.id === "palette-state");
    expect(stateTier?.items.map((item) => item.id)).toEqual([
      "palette-state-danger",
      "palette-state-success",
      "palette-state-warning",
      "palette-state-info",
    ]);
    // Every item opts into the lossless OKLCH color picker (zdtp >= 0.3.3).
    for (const tier of paletteTab?.tiers ?? []) {
      for (const item of tier.items) {
        expect(item.type).toEqual({ kind: "color", format: "oklch" });
      }
    }

    const colorTab = previewTokenPanelConfig.tabs.find((t) => t.id === "ui-color");
    expect(colorTab?.tiers.some((t) => t.id === "ui-palette")).toBe(false);
  });

  it("schemaId values are distinct (export JSON round-trips stay separate)", () => {
    expect(designTokenPanelConfig.schemaId).toBe("zudo-design-tokens/v3");
    expect(previewTokenPanelConfig.schemaId).toBe(
      "sg-preview-design-tokens/v1",
    );
    expect(designTokenPanelConfig.schemaId).not.toBe(
      previewTokenPanelConfig.schemaId,
    );
  });

  it("preview panel has an applySink wired", () => {
    expect(previewTokenPanelConfig.applySink).toBeDefined();
    expect(typeof previewTokenPanelConfig.applySink?.apply).toBe("function");
    expect(typeof previewTokenPanelConfig.applySink?.clear).toBe("function");
  });

  it("preview panel forwards applyEndpoint/applyRouting from virtual:zdtp-apply-config as-is", () => {
    // The mock above stands in for the build-mode branch of
    // plugins/zdtp-apply-proxy-plugin.mjs's setup() (both undefined) — the
    // dev-mode branch (real endpoint + routing map) is covered by
    // plugins/__tests__/zdtp-apply-proxy-plugin.test.ts. This test only
    // guards that the config module still reads the two fields from the
    // virtual module rather than hardcoding or dropping them.
    expect(previewTokenPanelConfig.applyEndpoint).toBeUndefined();
    expect(previewTokenPanelConfig.applyRouting).toBeUndefined();
  });

  it("doc panel has no applySink (writes to host :root)", () => {
    expect(designTokenPanelConfig.applySink).toBeUndefined();
  });
});
