// Ported from the host's former scripts/__tests__/ui-token-manifest.test.ts.
// Covers id/label derivation, default-value resolution from parsed CSS, and
// the drift error thrown when a spec'd token disappears from its source CSS.
//
// Some cases below deliberately read the REAL host project's CSS/manifest
// files (this package is developed in-repo, dogfooding the root zudo-sg
// host) — the relative paths climb out of the package to the monorepo root:
// packages/styleguide/src/cli/token-manifest/__tests__ -> ... -> <repo root>.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rgb as culoriRgb } from "culori";
import { describe, expect, it } from "vitest";
import { parseCssCustomProperties } from "../css-var-parser.js";
import { buildFromSpecs, buildPaletteColors, buildUiTokenManifest, renderUiTokenManifestFile, SIZE_SPECS } from "../ui-token-manifest.js";
import type { HostTokensSpec } from "../../../token-spec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");

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

function relativeLuminance(cssColor: string): number {
  const result = culoriRgb(cssColor);
  if (!result) throw new Error(`Cannot parse CSS color: ${cssColor}`);
  const toLinear = (value: number) => {
    const c = Math.max(0, Math.min(1, value));
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(result.r) + 0.7152 * toLinear(result.g) + 0.0722 * toLinear(result.b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

function resolveColorValue(vars: Map<string, string>, value: string, mode: "light" | "dark"): string {
  const trimmed = value.trim();
  const lightDark = /^light-dark\((.*),\s*(.*)\)$/.exec(trimmed);
  if (lightDark) {
    return resolveColorValue(vars, mode === "light" ? (lightDark[1] as string) : (lightDark[2] as string), mode);
  }
  const ref = /^var\((--[^)]+)\)$/.exec(trimmed);
  if (ref) {
    const target = vars.get(ref[1] as string);
    if (!target) throw new Error(`Missing CSS var ${ref[1]}`);
    return resolveColorValue(vars, target, mode);
  }
  return trimmed;
}

function resolveColorToken(vars: Map<string, string>, cssVar: string, mode: "light" | "dark"): string {
  const value = vars.get(cssVar);
  if (!value) throw new Error(`Missing CSS var ${cssVar}`);
  return resolveColorValue(vars, value, mode);
}

describe("buildUiTokenManifest", () => {
  it("derives id/label from cssVar, stripping the spacing- prefix for spacing tokens", () => {
    const tokensCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/tokens.css"), "utf8");
    const colorsCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");
    const manifest = buildUiTokenManifest({ tokensCss, colorsCss });

    const hsp2xs = manifest.spacingTokens.find((t) => t.cssVar === "--spacing-hsp-2xs");
    expect(hsp2xs).toMatchObject({ id: "ui-hsp-2xs", label: "hsp-2xs", group: "hsp", default: "0.125rem" });

    const fontSizeLh = manifest.fontTokens.find((t) => t.cssVar === "--text-xs--line-height");
    expect(fontSizeLh).toMatchObject({ id: "ui-text-xs--line-height", label: "text-xs / lh" });

    const colorBg = manifest.colorTokens.find((t) => t.cssVar === "--color-bg");
    expect(colorBg).toMatchObject({
      id: "ui-color-bg",
      label: "color-bg",
      control: "text",
      default: "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
    });
  });

  it("resolves default values from the CSS, not from any hardcoded copy", () => {
    const edited = FIXTURE_SIZE_CSS.replace("--radius-sm: 0.25rem;", "--radius-sm: 0.30rem;");
    const before = buildFromSpecs(SIZE_SPECS, parseCssCustomProperties(FIXTURE_SIZE_CSS), "fixture");
    const after = buildFromSpecs(SIZE_SPECS, parseCssCustomProperties(edited), "fixture");
    expect(before.find((t) => t.cssVar === "--radius-sm")?.default).toBe("0.25rem");
    expect(after.find((t) => t.cssVar === "--radius-sm")?.default).toBe("0.30rem");
  });

  it("throws a clear error when a spec'd cssVar is missing from its source CSS", () => {
    const withoutRadiusSm = FIXTURE_SIZE_CSS.replace("--radius-sm: 0.25rem;", "");
    expect(() => buildFromSpecs(SIZE_SPECS, parseCssCustomProperties(withoutRadiusSm), "fixture")).toThrow(
      /--radius-sm/,
    );
  });

  it("throws when a palette color referenced by the spec is missing", () => {
    expect(() =>
      buildPaletteColors(parseCssCustomProperties(`:root { --palette-neutral-0: oklch(1 0 0); }`)),
    ).toThrow(/--palette-neutral-1/);
  });

  it("keeps every semantic palette reference backed by a declared palette token", () => {
    const colorsCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");
    const vars = parseCssCustomProperties(colorsCss);
    const missingRefs: string[] = [];

    for (const [cssVar, value] of vars.entries()) {
      if (!cssVar.startsWith("--color-")) continue;
      const refs = value.matchAll(/var\((--palette-[^)]+)\)/g);
      for (const [, ref] of refs) {
        if (ref && !vars.has(ref)) missingRefs.push(`${cssVar} -> ${ref}`);
      }
    }

    expect(missingRefs).toEqual([]);
  });

  it("keeps the locked four-stop neutral mappings and required text pairs", () => {
    const colorsCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");
    const vars = parseCssCustomProperties(colorsCss);
    expect([
      ["--palette-neutral-0", "oklch(0.970 0.006 75)"],
      ["--palette-neutral-1", "oklch(0.885 0.009 75)"],
      ["--palette-neutral-2", "oklch(0.410 0.012 75)"],
      ["--palette-neutral-3", "oklch(0.235 0.010 75)"],
    ]).toEqual(
      Array.from(vars.entries())
        .filter(([name]) => name.startsWith("--palette-neutral-"))
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    expect({
      "--color-bg": vars.get("--color-bg"),
      "--color-surface": vars.get("--color-surface"),
      "--color-surface-2": vars.get("--color-surface-2"),
      "--color-border": vars.get("--color-border"),
      "--color-fg": vars.get("--color-fg"),
      "--color-muted": vars.get("--color-muted"),
      "--color-rail-bg": vars.get("--color-rail-bg"),
      "--color-rail-bg-strong": vars.get("--color-rail-bg-strong"),
      "--color-rail-hover-bg": vars.get("--color-rail-hover-bg"),
      "--color-rail-border": vars.get("--color-rail-border"),
      "--color-rail-fg": vars.get("--color-rail-fg"),
      "--color-rail-muted": vars.get("--color-rail-muted"),
    }).toEqual({
      "--color-bg": "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
      "--color-surface": "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
      "--color-surface-2": "light-dark(var(--palette-neutral-1), var(--palette-neutral-2))",
      "--color-border": "light-dark(var(--palette-neutral-1), var(--palette-neutral-2))",
      "--color-fg": "light-dark(var(--palette-neutral-3), var(--palette-neutral-0))",
      "--color-muted": "light-dark(var(--palette-neutral-2), var(--palette-neutral-1))",
      "--color-rail-bg": "var(--palette-neutral-3)",
      "--color-rail-bg-strong": "var(--palette-neutral-3)",
      "--color-rail-hover-bg": "var(--palette-neutral-2)",
      "--color-rail-border": "var(--palette-neutral-2)",
      "--color-rail-fg": "var(--palette-neutral-0)",
      "--color-rail-muted": "var(--palette-neutral-1)",
    });
    const pairs: Array<[string, string]> = [
      ["--color-fg", "--color-bg"],
      ["--color-fg", "--color-surface"],
      ["--color-fg", "--color-surface-2"],
      ["--color-muted", "--color-bg"],
      ["--color-muted", "--color-surface"],
      ["--color-muted", "--color-surface-2"],
      ["--color-on-accent", "--color-accent"],
      ["--color-on-accent", "--color-success"],
      ["--color-on-accent", "--color-danger"],
      ["--color-accent", "--color-bg"],
      ["--color-accent-hover", "--color-bg"],
    ];
    const failures: string[] = [];

    for (const mode of ["light", "dark"] as const) {
      for (const [fgVar, bgVar] of pairs) {
        const fg = resolveColorToken(vars, fgVar, mode);
        const bg = resolveColorToken(vars, bgVar, mode);
        const ratio = contrastRatio(fg, bg);
        const threshold = fgVar === "--color-fg" ? 7 : 4.5;
        if (ratio < threshold) failures.push(`${mode}: ${fgVar} on ${bgVar} = ${ratio.toFixed(2)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("renderUiTokenManifestFile", () => {
  it("is idempotent and matches the committed manifest for the real project CSS", () => {
    const tokensCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/tokens.css"), "utf8");
    const colorsCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");
    const committed = readFileSync(resolve(REPO_ROOT, "src/config/ui-design-tokens-manifest.ts"), "utf8");

    const manifest = buildUiTokenManifest({ tokensCss, colorsCss });

    // Same assertion `zudo-sg gen-token-manifest --check` makes — kept here too so
    // `pnpm test:unit` (which CI runs before build) catches drift as well.
    expect(
      renderUiTokenManifestFile(manifest, {
        tokensCssPath: "packages/demo-ui/styles/tokens.css",
        colorsCssPath: "packages/demo-ui/styles/colors.css",
      }),
    ).toBe(committed);
  });

  it("uses a single normalized path when both configured inputs are the same file", () => {
    const tokensCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/tokens.css"), "utf8");
    const colorsCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");
    const manifest = buildUiTokenManifest({ tokensCss, colorsCss });
    const rendered = renderUiTokenManifestFile(manifest, {
      tokensCssPath: "./src/styles/ui-tokens.css",
      colorsCssPath: "./src/styles/ui-tokens.css",
    });

    expect(rendered).toContain("Source of truth: `src/styles/ui-tokens.css`");
    expect(rendered).not.toContain("src/styles/ui-tokens.css` and `src/styles/ui-tokens.css");
    expect(rendered).not.toMatch(/demo-ui|pnpm gen:|pnpm check:/);
  });

  it("uses both normalized configured paths for separate foreign inputs", () => {
    const tokensCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/tokens.css"), "utf8");
    const colorsCss = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");
    const manifest = buildUiTokenManifest({ tokensCss, colorsCss });
    const rendered = renderUiTokenManifestFile(manifest, {
      tokensCssPath: "./node_modules/@example/ui/styles/tokens.css",
      colorsCssPath: "./node_modules/@example/ui/styles/colors.css",
    });

    expect(rendered).toContain("node_modules/@example/ui/styles/tokens.css");
    expect(rendered).toContain("node_modules/@example/ui/styles/colors.css");
    expect(rendered).not.toContain("./node_modules/@example/ui/styles/");
    expect(rendered).not.toMatch(/demo-ui|pnpm gen:|pnpm check:/);
  });
});

describe("host-owned tokens.spec", () => {
  const tokensCss = ":root { --gap-compact: calc(1rem / 2); --font-custom: 525; --line-custom: 1.4; }";
  const colorsCss = ":root { --brand-100: #eef; --brand-500: #336699; --ink: var(--brand-500); }";
  const spec: HostTokensSpec = {
    palette: [{ id: "brand", label: "Brand", tokens: [
      { cssVar: "--brand-100", label: "Pale" }, { cssVar: "--brand-500", readonly: true },
    ] }],
    color: [{ id: "roles", label: "Roles", tokens: [{ cssVar: "--ink", note: "Semantic role\nfrom host" }] }],
    spacing: [{ id: "rhythm", label: "Rhythm", preview: "bar", tokens: [{ cssVar: "--gap-compact", step: 0.125, unit: "rem", units: ["rem", "px"] }] }],
    font: [
      { id: "weights", label: "Weights", preview: "weight", tokens: [{ cssVar: "--font-custom", control: "select", options: ["400", "525", "700"] }] },
      { id: "leading", label: "Leading", preview: "line-height", previewBase: "--font-custom", tokens: [{ cssVar: "--line-custom" }] },
    ],
  };

  it("retains host names, CSS expressions, groups, options and empty categories deterministically", () => {
    const manifest = buildUiTokenManifest({ tokensCss, colorsCss, spec });
    expect(manifest.paletteColors).toMatchObject([
      { cssVar: "--brand-100", name: "brand-100", group: "brand", label: "Pale", value: "#eef" },
      { cssVar: "--brand-500", group: "brand", readonly: true, value: "#336699" },
    ]);
    expect(manifest.colorTokens[0]).toMatchObject({ default: "var(--brand-500)", control: "text" });
    expect(manifest.spacingTokens[0]).toMatchObject({ group: "rhythm", default: "calc(1rem / 2)", units: ["rem", "px"] });
    expect(manifest.fontTokens[0]?.options).toEqual(["400", "525", "700"]);
    expect(manifest.fontTokens[1]?.valueKind).toBe("number");
    expect(manifest.sizeTokens).toEqual([]);
    expect(manifest.groups?.size).toEqual([]);
    const provenance = { tokensCssPath: "tokens.css", colorsCssPath: "colors.css" };
    const rendered = renderUiTokenManifestFile(manifest, provenance);
    expect(rendered).toContain('options: ["400","525","700"]');
    expect(rendered).toContain('note: "Semantic role\\nfrom host"');
    expect(rendered).toContain('cssVar":"--brand-100"');
    expect(rendered).toContain("export const UI_TOKEN_GROUPS");
    expect(renderUiTokenManifestFile(buildUiTokenManifest({ tokensCss, colorsCss, spec }), provenance)).toBe(rendered);
  });

  it("accepts numeric-leading and non-ASCII CSS custom properties", () => {
    const manifest = buildUiTokenManifest({ tokensCss, colorsCss: ":root { --100: #fff; --brand-色: #333; }", spec: {
      palette: [{ id: "custom", label: "Custom", tokens: [{ cssVar: "--100" }, { cssVar: "--brand-色" }] }],
    } });
    expect(manifest.paletteColors.map((color) => color.cssVar)).toEqual(["--100", "--brand-色"]);
  });

  it.each([
    [{ spacing: null }, /expected an ordered array of groups/],
    [{ palette: [{ id: "brand", label: "Brand", tokens: [{ cssVar: "--missing" }] }] }, /--missing/],
    [{ palette: [{ id: "brand", label: "Brand", tokens: [{ cssVar: "--brand-100" }, { cssVar: "--brand-100" }] }] }, /already used/],
    [{ palette: [{ id: "brand", label: "Brand", tokens: [{ cssVar: "--brand-100", id: "same" }] }], color: [{ id: "roles", label: "Roles", tokens: [{ cssVar: "--ink", id: "same" }] }] }, /collides/],
    [{ palette: [{ id: "brand", label: "Brand", tokens: [] }, { id: "brand", label: "Again", tokens: [] }] }, /duplicate group/],
    [{ spacing: [{ id: "bad", label: "Bad", tokens: [{ cssVar: "--gap-compact", step: 0 }] }] }, /positive finite/],
    [{ font: [{ id: "bad", label: "Bad", tokens: [{ cssVar: "--font-custom", control: "select" }] }] }, /requires options/],
    [{ font: [{ id: "bad", label: "Bad", preview: "line-height", tokens: [{ cssVar: "--font-custom", unit: "rem" }] }] }, /unitless number/],
    [{ font: [{ id: "bad", label: "Bad", preview: "family", tokens: [{ cssVar: "--font-custom" }] }] }, /does not support length/],
    [{ color: [{ id: "bad", label: "Bad", preview: "bar", tokens: [{ cssVar: "--ink" }] }] }, /does not support text/],
    [{ palette: [{ id: "bad", label: "Bad", preview: "heatmap", tokens: [] }] }, /unsupported preview/],
  ] as Array<[unknown, RegExp]>)
    ("rejects malformed host spec %#", (bad, message) => {
      expect(() => buildUiTokenManifest({ tokensCss, colorsCss, spec: bad as HostTokensSpec })).toThrow(message);
    });
});
