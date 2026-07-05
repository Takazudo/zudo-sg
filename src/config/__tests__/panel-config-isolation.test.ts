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
// without pulling in @takazudo/zudo-doc/theme (which relies on browser APIs).
vi.mock(
  "@/features/styleguide/token-tweak/preview-iframe-registry",
  () => ({
    applyPreviewVars: vi.fn(),
    clearPreviewVars: vi.fn(),
  }),
);

// Mock @takazudo/zudo-doc/theme to expose DESIGN_TOKEN_SCHEMA without
// dragging in zfb island machinery (which expects a React package in the
// vitest environment).
vi.mock("@takazudo/zudo-doc/theme", () => ({
  DESIGN_TOKEN_SCHEMA: "zudo-doc-design-tokens/v1",
}));

// Mock @takazudo/zdtp — the configurePanel call happens in bootstrap modules,
// not in config modules, so only the types/exports we directly use are needed.
vi.mock("@takazudo/zdtp", () => ({}));

// Mock @/config/settings and @/config/color-schemes to avoid pulling in
// additional zfb-dependent modules during config module evaluation.
vi.mock("@/config/settings", () => ({
  settings: {
    colorScheme: "default",
    colorMode: false,
  },
}));
vi.mock("@/config/color-schemes", () => ({
  colorSchemes: {
    default: {
      palette: Array(16).fill("#808080"),
      shikiTheme: "github-dark",
    },
  },
}));
vi.mock("@/config/color-scheme-utils", () => ({
  SEMANTIC_DEFAULTS: {},
  SEMANTIC_CSS_NAMES: {},
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
    // RESERVED default ("toggle-design-token-panel"), which zdtp 0.3.0 wires
    // only to its empty-tabs default instance — leaving a real prefixed panel
    // on that channel orphaned (Takazudo/zudo-sg#84/#85).
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

  it("doc panel curates colorPresets (Scheme… dropdown extras)", () => {
    expect(Object.keys(designTokenPanelConfig.colorPresets ?? {}).length).toBeGreaterThan(0);
  });

  it("preview panel has a reserved 'palette' tab grouping families, separate from the 'ui-color' tab", () => {
    const paletteTab = previewTokenPanelConfig.tabs.find((t) => t.id === "palette");
    expect(paletteTab).toBeDefined();
    // Reserved-tab contract (zdtp 0.4.0): a 'palette' tab MUST omit
    // colorExtras — multiple `{ kind: "color" }` tiers are only safe together
    // when no cluster is resolved from the tab.
    expect(paletteTab?.colorExtras).toBeUndefined();

    // One TierConfig per --palette-{family}-{step} family (white/cool/warm/
    // brand/accent/success/danger), matching UI_PALETTE_COLORS in
    // ui-design-tokens-manifest.ts — NOT one flat 32-item tier, since the
    // curve editor derives every step in a tier from one shared curve.
    const tierIds = paletteTab?.tiers.map((t) => t.id).sort();
    expect(tierIds).toEqual(
      [
        "palette-accent",
        "palette-brand",
        "palette-cool",
        "palette-danger",
        "palette-success",
        "palette-warm",
        "palette-white",
      ].sort(),
    );
    const totalItems = paletteTab?.tiers.reduce((n, t) => n + t.items.length, 0);
    expect(totalItems).toBe(32);
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
    expect(designTokenPanelConfig.schemaId).toBe("zudo-doc-design-tokens/v1");
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
