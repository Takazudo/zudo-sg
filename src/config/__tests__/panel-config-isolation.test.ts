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

import { designTokenPanelConfig } from "../design-token-panel-config";
import { previewTokenPanelConfig } from "../preview-token-panel-config";

describe("panel config isolation", () => {
  it("storagePrefix values are distinct", () => {
    expect(designTokenPanelConfig.storagePrefix).toBe("my-doc-tweak");
    expect(previewTokenPanelConfig.storagePrefix).toBe("sg-preview-tweak");
    expect(designTokenPanelConfig.storagePrefix).not.toBe(
      previewTokenPanelConfig.storagePrefix,
    );
  });

  it("consoleNamespace values are distinct", () => {
    expect(designTokenPanelConfig.consoleNamespace).toBe("myDoc");
    expect(previewTokenPanelConfig.consoleNamespace).toBe("sgPreview");
    expect(designTokenPanelConfig.consoleNamespace).not.toBe(
      previewTokenPanelConfig.consoleNamespace,
    );
  });

  it("modalClassPrefix values are distinct", () => {
    expect(designTokenPanelConfig.modalClassPrefix).toBe(
      "my-doc-design-token-panel-modal",
    );
    expect(previewTokenPanelConfig.modalClassPrefix).toBe(
      "sg-preview-design-token-panel-modal",
    );
    expect(designTokenPanelConfig.modalClassPrefix).not.toBe(
      previewTokenPanelConfig.modalClassPrefix,
    );
  });

  it("toggleEvent values are distinct (doc panel uses default, preview panel is explicit)", () => {
    // The doc panel has no toggleEvent override (uses the default
    // "toggle-design-token-panel" channel via zdtp's toggleEventName logic).
    expect(designTokenPanelConfig.toggleEvent).toBeUndefined();
    expect(previewTokenPanelConfig.toggleEvent).toBe(
      "toggle-preview-token-panel",
    );
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

  it("doc panel has no applySink (writes to host :root)", () => {
    expect(designTokenPanelConfig.applySink).toBeUndefined();
  });
});
