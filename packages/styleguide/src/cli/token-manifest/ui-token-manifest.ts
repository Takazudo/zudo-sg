// Project-specific layer on top of css-var-parser.ts: knows which
// `--custom-properties` from a components root's token CSS files belong in
// the generated design-tokens manifest, and how to render that file.
//
// Split rationale: `id`, `label`, and `default` are fully derivable from the
// CSS (the var name + its parsed value) — deriving them keeps the manifest
// impossible to typo out of sync with its own cssVar. `group`/`step`/`unit`/
// `control`/`options`/`pill` are presentation metadata with no CSS
// equivalent (CSS has no notion of "render this as a select" or "step by
// 0.025") — those live in the SPECS tables below and are the one thing a
// human edits when a genuinely new token needs to appear in the panel.
//
// Ported from the host's former `scripts/lib/ui-token-manifest.mjs`. The
// SPECS tables are specific to `@zudo-sg/demo-ui`'s own token vocabulary (this is
// a mechanical port behind `zudo-sg.config.mjs`, not a generalization of the
// token schema itself — see docs/adr/styleguide-engine.md, issue #655).

import { parseCssCustomProperties } from "./css-var-parser.js";

// ---------------------------------------------------------------------------
// id / label derivation — same rule for every token, see comments inline.
// ---------------------------------------------------------------------------

const SPACING_PREFIX = "--spacing-";

/**
 * Strip the leading `--` from a cssVar, except for `--spacing-*` tokens where
 * the `spacing-` segment is also dropped (`--spacing-hsp-2xs` -> `hsp-2xs`).
 */
function suffixOf(cssVar: string): string {
  if (cssVar.startsWith(SPACING_PREFIX)) {
    return cssVar.slice(SPACING_PREFIX.length);
  }
  return cssVar.slice(2);
}

function idOf(cssVar: string): string {
  return `ui-${suffixOf(cssVar)}`;
}

/**
 * `--text-xs--line-height` gets the compact "text-xs / lh" label instead of
 * the verbose raw suffix.
 */
function labelOf(cssVar: string): string {
  const suffix = suffixOf(cssVar);
  const lineHeightMatch = suffix.match(/^(.*)--line-height$/);
  if (lineHeightMatch) return `${lineHeightMatch[1]} / lh`;
  return suffix;
}

// ---------------------------------------------------------------------------
// Specs — one entry per token that should appear in the manifest. `default`
// is intentionally absent here; buildUiTokenManifest() fills it in from the
// parsed CSS so a value can never drift from its source declaration.
// ---------------------------------------------------------------------------

const FONT_WEIGHT_OPTIONS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

export interface TokenSpec {
  cssVar: string;
  group: string;
  step?: number;
  unit?: string;
  control?: string;
  options?: string[];
  pill?: { value: string; customDefault: string };
  note?: string;
}

export interface BuiltToken {
  id: string;
  cssVar: string;
  label: string;
  group: string;
  default: string;
  step?: number;
  unit?: string;
  control?: string;
  options?: string[];
  pill?: { value: string; customDefault: string };
  note?: string;
}

export interface PaletteEntry {
  name: string;
  value: string;
}

/**
 * Tier-1 raw palette — every `--palette-*` in the colors CSS file's `:root`
 * block. Order matches the section order in that file (neutral, accent,
 * state, line) purely for readability; has no functional effect.
 */
export const PALETTE_NAMES = [
  "neutral-0", "neutral-1", "neutral-2", "neutral-3",
  "accent-0", "accent-1", "accent-2", "accent-3",
  "state-danger", "state-danger-dark",
  "state-success", "state-success-dark",
  "state-warning", "state-warning-dark",
  "state-info", "state-info-dark",
  "line-vacuum-accent", "line-vacuum-accent-dark", "line-vacuum-hover", "line-vacuum-hover-dark",
  "line-process-accent", "line-process-accent-dark", "line-process-hover", "line-process-hover-dark",
  "line-laser-accent", "line-laser-accent-dark", "line-laser-hover", "line-laser-hover-dark",
  "line-meeting-accent", "line-meeting-accent-dark", "line-meeting-hover", "line-meeting-hover-dark",
  "line-beauty-accent", "line-beauty-accent-dark", "line-beauty-hover", "line-beauty-hover-dark",
];

/**
 * Tier-2 canonical semantic color tokens (the grouped three-tier scheme).
 * All render as free-text rows (`light-dark()` / `color-mix()` expressions
 * can't drive a single-axis slider), so `control: "text"` is applied
 * uniformly in buildColorTokens().
 */
export const COLOR_SPECS: TokenSpec[] = [
  { cssVar: "--color-bg", group: "surface" },
  { cssVar: "--color-surface", group: "surface" },
  { cssVar: "--color-surface-2", group: "surface" },
  { cssVar: "--color-border", group: "surface" },
  {
    cssVar: "--color-loading-scrim",
    group: "surface",
    note: "Translucent frost scrim derived from --color-bg (SPA loading overlay).",
  },
  { cssVar: "--color-fg", group: "text" },
  { cssVar: "--color-muted", group: "text" },
  { cssVar: "--color-accent", group: "accent" },
  { cssVar: "--color-accent-hover", group: "accent" },
  {
    cssVar: "--color-on-accent",
    group: "accent",
    note: "Foreground token for text/icons on filled accent/state surfaces (consumed via `text-on-accent`).",
  },
  { cssVar: "--color-focus", group: "accent" },
  { cssVar: "--color-rail-bg", group: "rail" },
  { cssVar: "--color-rail-bg-strong", group: "rail" },
  { cssVar: "--color-rail-fg", group: "rail" },
  { cssVar: "--color-rail-muted", group: "rail" },
  { cssVar: "--color-rail-border", group: "rail" },
  { cssVar: "--color-rail-hover-bg", group: "rail" },
  { cssVar: "--color-success", group: "state" },
  { cssVar: "--color-danger", group: "state" },
  { cssVar: "--color-warning", group: "state" },
  { cssVar: "--color-info", group: "state" },
];

/** Horizontal (hsp) + vertical (vsp) spacing axes. */
export const SPACING_SPECS: TokenSpec[] = [
  { cssVar: "--spacing-hsp-2xs", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-xs", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-sm", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-md", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-lg", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-xl", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-2xl", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-3xs", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-2xs", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-xs", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-sm", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-md", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-lg", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-xl", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-2xl", group: "vsp", step: 0.025, unit: "rem" },
];

/** Font sizes, paired line-heights, weights, line-heights, families. */
export const FONT_SPECS: TokenSpec[] = [
  { cssVar: "--text-xs", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-sm", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-base", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-lg", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-xl", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-2xl", group: "font-size", step: 0.05, unit: "rem" },

  { cssVar: "--text-xs--line-height", group: "font-size-lh", step: 0.05, unit: "" },
  { cssVar: "--text-sm--line-height", group: "font-size-lh", step: 0.05, unit: "" },
  { cssVar: "--text-base--line-height", group: "font-size-lh", step: 0.05, unit: "" },
  { cssVar: "--text-lg--line-height", group: "font-size-lh", step: 0.05, unit: "" },
  { cssVar: "--text-xl--line-height", group: "font-size-lh", step: 0.05, unit: "" },
  { cssVar: "--text-2xl--line-height", group: "font-size-lh", step: 0.05, unit: "" },

  { cssVar: "--font-weight-normal", group: "font-weight", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { cssVar: "--font-weight-medium", group: "font-weight", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { cssVar: "--font-weight-semibold", group: "font-weight", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { cssVar: "--font-weight-bold", group: "font-weight", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },

  { cssVar: "--leading-tight", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-snug", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-normal", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-relaxed", group: "line-height", step: 0.05, unit: "" },

  { cssVar: "--font-sans", group: "font-family", step: 1, unit: "", control: "text" },
  { cssVar: "--font-mono", group: "font-family", step: 1, unit: "", control: "text" },
];

/**
 * Radius + shadow. Shadows are free-text rows: multi-layer `box-shadow`
 * expressions can't be driven by a single-axis slider.
 */
export const SIZE_SPECS: TokenSpec[] = [
  // `unit` MUST match the unit the token is authored in, because the panel
  // appends it to whatever bare number the user types. `--radius-full` is
  // the exception: its value really is the px pill sentinel `9999px`.
  { cssVar: "--radius-DEFAULT", group: "radius", step: 0.05, unit: "rem" },
  { cssVar: "--radius-sm", group: "radius", step: 0.05, unit: "rem" },
  { cssVar: "--radius-md", group: "radius", step: 0.05, unit: "rem" },
  { cssVar: "--radius-lg", group: "radius", step: 0.05, unit: "rem" },
  { cssVar: "--radius-full", group: "radius", step: 1, unit: "px", pill: { value: "9999px", customDefault: "16px" } },
  { cssVar: "--shadow-card", group: "shadow", step: 1, unit: "", control: "text" },
  { cssVar: "--shadow-raised", group: "shadow", step: 1, unit: "", control: "text" },
  { cssVar: "--shadow-overlay", group: "shadow", step: 1, unit: "", control: "text" },
];

// ---------------------------------------------------------------------------
// Building — resolve each spec's `default` against the parsed CSS.
// ---------------------------------------------------------------------------

export function lookup(vars: Map<string, string>, cssVar: string, sourceLabel: string): string {
  const value = vars.get(cssVar);
  if (value === undefined) {
    throw new Error(
      `${cssVar} is listed in the token manifest spec but was not found in ${sourceLabel}. ` +
        "Either the CSS var was renamed/removed (update the spec in ui-token-manifest.ts), " +
        "or this is a real drift.",
    );
  }
  return value;
}

export function buildPaletteColors(colorVars: Map<string, string>): PaletteEntry[] {
  return PALETTE_NAMES.map((name) => ({
    name,
    value: lookup(colorVars, `--palette-${name}`, "the colors CSS file"),
  }));
}

export function buildColorTokens(colorVars: Map<string, string>): BuiltToken[] {
  return COLOR_SPECS.map(({ cssVar, group, note }) => ({
    id: idOf(cssVar),
    cssVar,
    label: labelOf(cssVar),
    group,
    default: lookup(colorVars, cssVar, "the colors CSS file"),
    step: 1,
    unit: "",
    control: "text",
    ...(note ? { note } : {}),
  }));
}

export function buildFromSpecs(specs: TokenSpec[], tokenVars: Map<string, string>, sourceLabel: string): BuiltToken[] {
  return specs.map(({ cssVar, group, step, unit, control, options, pill }) => ({
    id: idOf(cssVar),
    cssVar,
    label: labelOf(cssVar),
    group,
    default: lookup(tokenVars, cssVar, sourceLabel),
    step,
    unit,
    ...(control ? { control } : {}),
    ...(options ? { options } : {}),
    ...(pill ? { pill } : {}),
  }));
}

export interface UiTokenManifest {
  paletteColors: PaletteEntry[];
  colorTokens: BuiltToken[];
  spacingTokens: BuiltToken[];
  fontTokens: BuiltToken[];
  sizeTokens: BuiltToken[];
}

export interface TokenManifestProvenance {
  /** Project-root-relative path configured for spacing/font/size tokens. */
  tokensCssPath: string;
  /** Project-root-relative path configured for palette/semantic color tokens. */
  colorsCssPath: string;
}

/**
 * Parse `tokensCss` (the components root's main tokens file) and
 * `colorsCss` (its colors file) and build the full manifest data — the same
 * shape as the arrays exported by the generated manifest, minus the TS
 * syntax.
 */
export function buildUiTokenManifest({ tokensCss, colorsCss }: { tokensCss: string; colorsCss: string }): UiTokenManifest {
  const tokenVars = parseCssCustomProperties(tokensCss);
  const colorVars = parseCssCustomProperties(colorsCss);
  return {
    paletteColors: buildPaletteColors(colorVars),
    colorTokens: buildColorTokens(colorVars),
    spacingTokens: buildFromSpecs(SPACING_SPECS, tokenVars, "the tokens CSS file"),
    fontTokens: buildFromSpecs(FONT_SPECS, tokenVars, "the tokens CSS file"),
    sizeTokens: buildFromSpecs(SIZE_SPECS, tokenVars, "the tokens CSS file"),
  };
}

// ---------------------------------------------------------------------------
// Rendering — manifest data -> the literal .ts source text.
// ---------------------------------------------------------------------------

function jsStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function normalizeProvenancePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function renderTokenDefObject(token: BuiltToken, indent: number): string {
  const pad = " ".repeat(indent);
  const fields = [
    `id: ${jsStringLiteral(token.id)}`,
    `cssVar: ${jsStringLiteral(token.cssVar)}`,
    `label: ${jsStringLiteral(token.label)}`,
    `group: ${jsStringLiteral(token.group)}`,
    `default: ${jsStringLiteral(token.default)}`,
    `step: ${token.step}`,
    `unit: ${jsStringLiteral(token.unit ?? "")}`,
  ];
  if (token.control) fields.push(`control: ${jsStringLiteral(token.control)}`);
  if (token.options) {
    fields.push(`options: FONT_WEIGHT_OPTIONS`);
  }
  if (token.pill) {
    fields.push(
      `pill: { value: ${jsStringLiteral(token.pill.value)}, customDefault: ${jsStringLiteral(token.pill.customDefault)} }`,
    );
  }
  const body = fields.map((f) => `${pad}  ${f},`).join("\n");
  const note = token.note ? `${pad}// ${token.note}\n` : "";
  return `${note}${pad}{\n${body}\n${pad}},`;
}

function renderPaletteEntry(entry: PaletteEntry): string {
  return `  { name: ${jsStringLiteral(entry.name)}, value: ${jsStringLiteral(entry.value)} },`;
}

/** Render the full generated manifest `.ts` source. */
export function renderUiTokenManifestFile(
  manifest: UiTokenManifest,
  provenance: TokenManifestProvenance,
): string {
  const tokensCssPath = normalizeProvenancePath(provenance.tokensCssPath);
  const colorsCssPath = normalizeProvenancePath(provenance.colorsCssPath);
  const sourceOfTruth =
    tokensCssPath === colorsCssPath
      ? `\`${tokensCssPath}\``
      : `\`${tokensCssPath}\` and \`${colorsCssPath}\``;
  const paletteLines = manifest.paletteColors.map(renderPaletteEntry).join("\n");
  const colorLines = manifest.colorTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const spacingLines = manifest.spacingTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const fontLines = manifest.fontTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const sizeLines = manifest.sizeTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");

  return `/**
 * Design-token manifest for configured UI tokens.
 *
 * GENERATED — do not hand-edit. Run \`zudo-sg gen-token-manifest\` after changing
 * either configured source file, then commit the regenerated output.
 * \`zudo-sg gen-token-manifest --check\` fails on drift.
 *
 * Source of truth: ${sourceOfTruth},
 * parsed by the \`zudo-sg gen-token-manifest\` CLI command
 * (@takazudo/zudo-sg's src/cli/token-manifest/ui-token-manifest.ts). Only
 * \`default\` values are derived from the CSS; \`group\`/\`step\`/\`unit\`/
 * \`control\`/\`options\`/\`pill\` are presentation metadata with no CSS
 * equivalent and are configured in that module's SPECS tables.
 *
 * Covers: Color / Spacing / Font / Size tabs.
 * Does NOT include any --zd-* doc-chrome tokens.
 */
import type { TokenDef } from "@takazudo/zdtp";

// --- Font weight select options ---
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

/**
 * Tier-1 raw palette colors from \`${colorsCssPath}\` (the \`:root\`
 * \`--palette-{group}-{step-or-role}\` block). This is the raw material beneath the
 * semantic \`--color-*\` tokens in UI_COLOR_TOKENS below — same three-tier
 * model the doc-chrome panel exposes via \`--palette-*\` ramps and \`--zd-*\`
 * semantic roles.
 *
 * These are plain name/value descriptors (NOT \`TokenDef\`) because zdtp's
 * \`TokenDef.control\` has no \`"color"\` option — the preview panel builds them
 * into \`{ kind: "color" }\` TierItems inline, mirroring the doc panel's
 * ramp tiers. Rendered as a "Palette" swatch tier in the preview
 * panel's Color tab; editing a swatch pushes \`--palette-*\` to the preview
 * iframes via the sink, cascading into every semantic token that references it.
 *
 * Coverage: ${manifest.paletteColors.length} colors.
 */
export interface UiPaletteColor {
  /** Palette key without the \`--palette-\` prefix, e.g. "neutral-2". */
  name: string;
  /** Raw oklch value, from \`${colorsCssPath}\`. */
  value: string;
}

export const UI_PALETTE_COLORS: readonly UiPaletteColor[] = [
${paletteLines}
];

/**
 * Color tokens from \`${colorsCssPath}\`.
 *
 * All values use light-dark() for dual-scheme support. Defaults here are
 * the full CSS declarations including both light and dark sides.
 * Stored as read-only text rows because light-dark() expressions cannot
 * be driven by a single-axis slider.
 *
 * Coverage: ${manifest.colorTokens.length} tokens total.
 */
export const UI_COLOR_TOKENS: readonly TokenDef[] = [
${colorLines}
];

/**
 * Spacing tokens from \`${tokensCssPath}\`.
 *
 * Coverage: ${manifest.spacingTokens.length} tokens total.
 */
export const UI_SPACING_TOKENS: readonly TokenDef[] = [
${spacingLines}
];

/**
 * Font tokens from \`${tokensCssPath}\`.
 *
 * Coverage: ${manifest.fontTokens.length} tokens total.
 */
export const UI_FONT_TOKENS: readonly TokenDef[] = [
${fontLines}
];

/**
 * Size tokens from \`${tokensCssPath}\`.
 *
 * Coverage: ${manifest.sizeTokens.length} tokens total.
 * \`--radius-full\` carries a pill toggle (sentinel 9999px).
 */
export const UI_SIZE_TOKENS: readonly TokenDef[] = [
${sizeLines}
];
`;
}
