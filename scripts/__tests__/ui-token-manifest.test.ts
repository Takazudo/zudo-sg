// scripts/__tests__/ui-token-manifest.test.ts
//
// Unit tests for scripts/lib/ui-token-manifest.mjs — the spec tables +
// builder/renderer that scripts/gen-token-manifest.mjs drives. Covers id/label
// derivation, default-value resolution from parsed CSS, and the drift error
// thrown when a spec'd token disappears from its source CSS.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCssCustomProperties } from "../lib/css-var-parser.mjs";
import {
  buildFromSpecs,
  buildPaletteColors,
  buildUiTokenManifest,
  renderUiTokenManifestFile,
  SIZE_SPECS,
} from "../lib/ui-token-manifest.mjs";

// Covers every var SIZE_SPECS looks up, so buildFromSpecs(SIZE_SPECS, ...)
// can run against a small fixture instead of the full project CSS.
const FIXTURE_SIZE_CSS = `
  @theme {
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --radius-lg: 1rem;
    --radius-full: 9999px;
    --shadow-card: 0 1px 2px oklch(0.2 0.03 264 / 0.05);
    --shadow-raised: 0 2px 4px oklch(0.2 0.03 264 / 0.06);
    --shadow-overlay: 0 4px 8px oklch(0.2 0.03 264 / 0.08);
  }
`;

describe("buildUiTokenManifest", () => {
  it("derives id/label from cssVar, stripping the spacing- prefix for spacing tokens", () => {
    // Full CSS needed since every spec entry is looked up; fixture above
    // only covers a subset, so use the real project files for this pass.
    const tokensCss = readFileSync(
      resolve(__dirname, "../../packages/ui/styles/tokens.css"),
      "utf8",
    );
    const colorsCss = readFileSync(
      resolve(__dirname, "../../packages/ui/styles/colors.css"),
      "utf8",
    );
    const manifest = buildUiTokenManifest({ tokensCss, colorsCss });

    const hsp2xs = manifest.spacingTokens.find(
      (t) => t.cssVar === "--spacing-hsp-2xs",
    );
    expect(hsp2xs).toMatchObject({
      id: "ui-hsp-2xs",
      label: "hsp-2xs",
      group: "hsp",
      default: "0.125rem",
    });

    const fontSizeLh = manifest.fontTokens.find(
      (t) => t.cssVar === "--text-xs--line-height",
    );
    expect(fontSizeLh).toMatchObject({
      id: "ui-text-xs--line-height",
      label: "text-xs / lh",
    });

    const colorInk = manifest.colorTokens.find((t) => t.cssVar === "--color-ink");
    expect(colorInk).toMatchObject({
      id: "ui-color-ink",
      label: "color-ink",
      control: "text",
      default: "light-dark(var(--palette-cool-700), var(--palette-cool-50))",
    });
  });

  it("resolves default values from the CSS, not from any hardcoded copy", () => {
    // A CSS-only change (no spec change) must change the built default —
    // this is the actual drift guarantee `check:token-manifest` relies on.
    const edited = FIXTURE_SIZE_CSS.replace(
      "--radius-sm: 0.25rem;",
      "--radius-sm: 0.30rem;",
    );
    const before = buildFromSpecs(
      SIZE_SPECS,
      parseCssCustomProperties(FIXTURE_SIZE_CSS),
      "fixture",
    );
    const after = buildFromSpecs(
      SIZE_SPECS,
      parseCssCustomProperties(edited),
      "fixture",
    );
    expect(before.find((t) => t.cssVar === "--radius-sm")?.default).toBe(
      "0.25rem",
    );
    expect(after.find((t) => t.cssVar === "--radius-sm")?.default).toBe(
      "0.30rem",
    );
  });

  it("throws a clear error when a spec'd cssVar is missing from its source CSS", () => {
    const withoutRadiusSm = FIXTURE_SIZE_CSS.replace(
      "--radius-sm: 0.25rem;",
      "",
    );
    expect(() =>
      buildFromSpecs(
        SIZE_SPECS,
        parseCssCustomProperties(withoutRadiusSm),
        "fixture",
      ),
    ).toThrow(/--radius-sm/);
  });

  it("throws when a palette color referenced by the spec is missing", () => {
    expect(() =>
      buildPaletteColors(parseCssCustomProperties(`:root { --palette-white: oklch(1 0 0); }`)),
    ).toThrow(/--palette-cool-50/);
  });
});

describe("renderUiTokenManifestFile", () => {
  it("is idempotent and matches the committed manifest for the real project CSS", () => {
    const tokensCss = readFileSync(
      resolve(__dirname, "../../packages/ui/styles/tokens.css"),
      "utf8",
    );
    const colorsCss = readFileSync(
      resolve(__dirname, "../../packages/ui/styles/colors.css"),
      "utf8",
    );
    const committed = readFileSync(
      resolve(__dirname, "../../src/config/ui-design-tokens-manifest.ts"),
      "utf8",
    );

    const manifest = buildUiTokenManifest({ tokensCss, colorsCss });
    const rendered = renderUiTokenManifestFile(manifest);

    // Same assertion `pnpm check:token-manifest` makes — kept here too so
    // `pnpm test:unit` (which CI runs before build) catches drift as well.
    expect(rendered).toBe(committed);
  });
});
