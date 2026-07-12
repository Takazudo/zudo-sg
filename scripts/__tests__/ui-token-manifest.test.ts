// scripts/__tests__/ui-token-manifest.test.ts
//
// Unit tests for scripts/lib/ui-token-manifest.mjs — the spec tables +
// builder/renderer that scripts/gen-token-manifest.mjs drives. Covers id/label
// derivation, default-value resolution from parsed CSS, and the drift error
// thrown when a spec'd token disappears from its source CSS.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rgb as culoriRgb } from "culori";
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
    --radius-DEFAULT: 0.25rem;
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --radius-lg: 1rem;
    --radius-full: 9999px;
    --shadow-card: 0 1px 2px oklch(0.2 0.03 264 / 0.05);
    --shadow-raised: 0 2px 4px oklch(0.2 0.03 264 / 0.06);
    --shadow-overlay: 0 4px 8px oklch(0.2 0.03 264 / 0.08);
  }
`;

function relativeLuminance(cssColor) {
  const result = culoriRgb(cssColor);
  if (!result) throw new Error(`Cannot parse CSS color: ${cssColor}`);
  const toLinear = (value) => {
    const c = Math.max(0, Math.min(1, value));
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(result.r) +
    0.7152 * toLinear(result.g) +
    0.0722 * toLinear(result.b)
  );
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

function resolveColorValue(vars, value, mode) {
  const trimmed = value.trim();
  const lightDark = /^light-dark\((.*),\s*(.*)\)$/.exec(trimmed);
  if (lightDark) {
    return resolveColorValue(vars, mode === "light" ? lightDark[1] : lightDark[2], mode);
  }
  const ref = /^var\((--[^)]+)\)$/.exec(trimmed);
  if (ref) {
    const target = vars.get(ref[1]);
    if (!target) throw new Error(`Missing CSS var ${ref[1]}`);
    return resolveColorValue(vars, target, mode);
  }
  return trimmed;
}

function resolveColorToken(vars, cssVar, mode) {
  const value = vars.get(cssVar);
  if (!value) throw new Error(`Missing CSS var ${cssVar}`);
  return resolveColorValue(vars, value, mode);
}

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

    const colorBg = manifest.colorTokens.find((t) => t.cssVar === "--color-bg");
    expect(colorBg).toMatchObject({
      id: "ui-color-bg",
      label: "color-bg",
      control: "text",
      default: "light-dark(var(--palette-base-0), var(--palette-base-10))",
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
      buildPaletteColors(parseCssCustomProperties(`:root { --palette-base-0: oklch(1 0 0); }`)),
    ).toThrow(/--palette-base-1/);
  });

  it("keeps every semantic palette reference backed by a declared palette token", () => {
    const colorsCss = readFileSync(
      resolve(__dirname, "../../packages/ui/styles/colors.css"),
      "utf8",
    );
    const vars = parseCssCustomProperties(colorsCss);
    const missingRefs = [];

    for (const [cssVar, value] of vars.entries()) {
      if (!cssVar.startsWith("--color-")) continue;
      const refs = value.matchAll(/var\((--palette-[^)]+)\)/g);
      for (const [, ref] of refs) {
        if (ref && !vars.has(ref)) {
          missingRefs.push(`${cssVar} -> ${ref}`);
        }
      }
    }

    expect(missingRefs).toEqual([]);
  });

  it("keeps required semantic color pairs at AA text contrast in light and dark", () => {
    const colorsCss = readFileSync(
      resolve(__dirname, "../../packages/ui/styles/colors.css"),
      "utf8",
    );
    const vars = parseCssCustomProperties(colorsCss);
    const pairs = [
      ["--color-ink", "--color-surface"],
      ["--color-ink-soft", "--color-surface"],
      ["--color-ink-mute", "--color-surface"],
      ["--color-on-brand", "--color-brand"],
      ["--color-on-brand", "--color-success"],
      ["--color-on-brand", "--color-danger"],
      ["--color-brand", "--color-paper"],
      ["--color-brand-strong", "--color-paper"],
    ];
    const failures = [];

    for (const mode of ["light", "dark"]) {
      for (const [fgVar, bgVar] of pairs) {
        const fg = resolveColorToken(vars, fgVar, mode);
        const bg = resolveColorToken(vars, bgVar, mode);
        const ratio = contrastRatio(fg, bg);
        if (ratio < 4.5) {
          failures.push(`${mode}: ${fgVar} on ${bgVar} = ${ratio.toFixed(2)}`);
        }
      }
    }

    expect(failures).toEqual([]);
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
