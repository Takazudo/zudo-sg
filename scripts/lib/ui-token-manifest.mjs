// scripts/lib/ui-token-manifest.mjs
//
// Project-specific layer on top of css-var-parser.mjs: knows which
// `--custom-properties` from `packages/ui/styles/{tokens,colors}.css` belong
// in `src/config/ui-design-tokens-manifest.ts`, and how to render that file.
//
// Split rationale: `id`, `label`, and `default` are fully derivable from the
// CSS (the var name + its parsed value) — deriving them keeps the manifest
// impossible to typo out of sync with its own cssVar. `group`, `step`, `unit`,
// `control`, `options`, and `pill` are presentation metadata with no CSS
// equivalent (CSS has no notion of "render this as a select" or "step by
// 0.025") — those live in the SPECS tables below and are the one thing a
// human edits when a *new* token needs to appear in the panel.

import { parseCssCustomProperties } from "./css-var-parser.mjs";

// ---------------------------------------------------------------------------
// id / label derivation — same rule for every token, see comments inline.
// ---------------------------------------------------------------------------

const SPACING_PREFIX = "--spacing-";

/**
 * Strip the leading `--` from a cssVar, except for `--spacing-*` tokens where
 * the `spacing-` segment is also dropped (`--spacing-hsp-2xs` -> `hsp-2xs`) —
 * matches the hand-written manifest's existing id/label shape, where the
 * spacing axis name (hsp/vsp) stands alone without a redundant "spacing-"
 * prefix.
 */
function suffixOf(cssVar) {
  if (cssVar.startsWith(SPACING_PREFIX)) {
    return cssVar.slice(SPACING_PREFIX.length);
  }
  return cssVar.slice(2);
}

function idOf(cssVar) {
  return `ui-${suffixOf(cssVar)}`;
}

/**
 * `--text-xs--line-height` gets the compact "text-xs / lh" label
 * (matches the hand-written manifest) instead of the verbose raw suffix.
 */
function labelOf(cssVar) {
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

const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
];

/**
 * Tier-1 raw palette — every `--palette-*` in colors.css's `:root` block.
 * Order matches the section order in colors.css (base, accent, state) purely
 * for readability; has no functional effect.
 */
export const PALETTE_NAMES = [
  "base-0", "base-1", "base-2", "base-3", "base-4",
  "accent-0", "accent-1", "accent-2",
  "state-danger", "state-success", "state-warning", "state-info",
];

/**
 * Tier-2 semantic color tokens. All render as free-text rows (`light-dark()`
 * expressions can't drive a single-axis slider), so `control: "text"` is
 * applied uniformly in buildColorTokens() rather than repeated per entry.
 */
export const COLOR_SPECS = [
  { cssVar: "--color-ink", group: "ink" },
  { cssVar: "--color-ink-soft", group: "ink" },
  { cssVar: "--color-ink-mute", group: "ink" },
  { cssVar: "--color-paper", group: "surface" },
  { cssVar: "--color-surface", group: "surface" },
  { cssVar: "--color-surface-sunken", group: "surface" },
  { cssVar: "--color-line", group: "line" },
  { cssVar: "--color-line-strong", group: "line" },
  { cssVar: "--color-brand", group: "brand" },
  { cssVar: "--color-brand-strong", group: "brand" },
  { cssVar: "--color-brand-soft", group: "brand" },
  {
    cssVar: "--color-on-brand",
    group: "brand",
    note:
      "Foreground token for filled brand/state surfaces (consumed via `text-on-brand`).",
  },
  { cssVar: "--color-accent", group: "state" },
  { cssVar: "--color-success", group: "state" },
  { cssVar: "--color-success-soft", group: "state" },
  { cssVar: "--color-danger", group: "state" },
  { cssVar: "--color-danger-soft", group: "state" },
  { cssVar: "--color-focus", group: "state" },
];

/** Horizontal (hsp) + vertical (vsp) spacing axes from tokens.css. */
export const SPACING_SPECS = [
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
export const FONT_SPECS = [
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

  {
    cssVar: "--font-weight-normal",
    group: "font-weight",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    cssVar: "--font-weight-medium",
    group: "font-weight",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    cssVar: "--font-weight-semibold",
    group: "font-weight",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    cssVar: "--font-weight-bold",
    group: "font-weight",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },

  { cssVar: "--leading-tight", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-normal", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-relaxed", group: "line-height", step: 0.05, unit: "" },

  { cssVar: "--font-sans", group: "font-family", step: 1, unit: "", control: "text" },
  { cssVar: "--font-mono", group: "font-family", step: 1, unit: "", control: "text" },
];

/**
 * Radius + shadow. Shadows are free-text rows: multi-layer `box-shadow`
 * expressions can't be driven by a single-axis slider.
 */
export const SIZE_SPECS = [
  { cssVar: "--radius-sm", group: "radius", step: 1, unit: "px" },
  { cssVar: "--radius-md", group: "radius", step: 1, unit: "px" },
  { cssVar: "--radius-lg", group: "radius", step: 1, unit: "px" },
  {
    cssVar: "--radius-full",
    group: "radius",
    step: 1,
    unit: "px",
    pill: { value: "9999px", customDefault: "16px" },
  },
  { cssVar: "--shadow-card", group: "shadow", step: 1, unit: "", control: "text" },
  { cssVar: "--shadow-raised", group: "shadow", step: 1, unit: "", control: "text" },
  { cssVar: "--shadow-overlay", group: "shadow", step: 1, unit: "", control: "text" },
];

// ---------------------------------------------------------------------------
// Building — resolve each spec's `default` against the parsed CSS.
// ---------------------------------------------------------------------------

export function lookup(vars, cssVar, sourceLabel) {
  const value = vars.get(cssVar);
  if (value === undefined) {
    throw new Error(
      `${cssVar} is listed in the token manifest spec but was not found in ${sourceLabel}. ` +
        "Either the CSS var was renamed/removed (update the spec in scripts/lib/ui-token-manifest.mjs), " +
        "or this is a real drift.",
    );
  }
  return value;
}

export function buildPaletteColors(colorVars) {
  return PALETTE_NAMES.map((name) => ({
    name,
    value: lookup(colorVars, `--palette-${name}`, "packages/ui/styles/colors.css"),
  }));
}

export function buildColorTokens(colorVars) {
  return COLOR_SPECS.map(({ cssVar, group, note }) => ({
    id: idOf(cssVar),
    cssVar,
    label: labelOf(cssVar),
    group,
    default: lookup(colorVars, cssVar, "packages/ui/styles/colors.css"),
    step: 1,
    unit: "",
    control: "text",
    ...(note ? { note } : {}),
  }));
}

export function buildFromSpecs(specs, tokenVars, sourceLabel) {
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

/**
 * Parse `tokensCss` (packages/ui/styles/tokens.css) and `colorsCss`
 * (packages/ui/styles/colors.css) and build the full manifest data — the same
 * shape as the arrays exported by `src/config/ui-design-tokens-manifest.ts`,
 * minus the TS syntax.
 *
 * @param {{ tokensCss: string, colorsCss: string }} sources
 */
export function buildUiTokenManifest({ tokensCss, colorsCss }) {
  const tokenVars = parseCssCustomProperties(tokensCss);
  const colorVars = parseCssCustomProperties(colorsCss);
  return {
    paletteColors: buildPaletteColors(colorVars),
    colorTokens: buildColorTokens(colorVars),
    spacingTokens: buildFromSpecs(SPACING_SPECS, tokenVars, "packages/ui/styles/tokens.css"),
    fontTokens: buildFromSpecs(FONT_SPECS, tokenVars, "packages/ui/styles/tokens.css"),
    sizeTokens: buildFromSpecs(SIZE_SPECS, tokenVars, "packages/ui/styles/tokens.css"),
  };
}

// ---------------------------------------------------------------------------
// Rendering — manifest data -> the literal .ts source text.
// ---------------------------------------------------------------------------

function jsStringLiteral(value) {
  return JSON.stringify(value);
}

function renderTokenDefObject(token, indent) {
  const pad = " ".repeat(indent);
  const fields = [
    `id: ${jsStringLiteral(token.id)}`,
    `cssVar: ${jsStringLiteral(token.cssVar)}`,
    `label: ${jsStringLiteral(token.label)}`,
    `group: ${jsStringLiteral(token.group)}`,
    `default: ${jsStringLiteral(token.default)}`,
    `step: ${token.step}`,
    `unit: ${jsStringLiteral(token.unit)}`,
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

function renderPaletteEntry(entry) {
  return `  { name: ${jsStringLiteral(entry.name)}, value: ${jsStringLiteral(entry.value)} },`;
}

/**
 * Render the full `src/config/ui-design-tokens-manifest.ts` source.
 *
 * @param {ReturnType<typeof buildUiTokenManifest>} manifest
 */
export function renderUiTokenManifestFile(manifest) {
  const paletteLines = manifest.paletteColors.map(renderPaletteEntry).join("\n");
  const colorLines = manifest.colorTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const spacingLines = manifest.spacingTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const fontLines = manifest.fontTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const sizeLines = manifest.sizeTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");

  return `/**
 * Design-token manifest for @zudo-sg/ui target-website tokens.
 *
 * GENERATED — do not hand-edit. Run \`pnpm gen:token-manifest\` after changing
 * packages/ui/styles/tokens.css or packages/ui/styles/colors.css, then commit
 * the regenerated output. \`pnpm check:token-manifest\` fails on drift.
 *
 * Source of truth: packages/ui/styles/tokens.css and packages/ui/styles/colors.css,
 * parsed by scripts/gen-token-manifest.mjs (scripts/lib/ui-token-manifest.mjs).
 * Only \`default\` values are derived from the CSS; \`group\`/\`step\`/\`unit\`/
 * \`control\`/\`options\`/\`pill\` are presentation metadata with no CSS
 * equivalent and are configured in that script's SPECS tables.
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
 * Tier-1 raw palette colors from \`packages/ui/styles/colors.css\` (the \`:root\`
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
  /** Palette key without the \`--palette-\` prefix, e.g. "base-4". */
  name: string;
  /** Raw oklch value, from colors.css. */
  value: string;
}

export const UI_PALETTE_COLORS: readonly UiPaletteColor[] = [
${paletteLines}
];

/**
 * Color tokens from \`packages/ui/styles/colors.css\`.
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
 * Spacing tokens from \`packages/ui/styles/tokens.css\`.
 *
 * Coverage: ${manifest.spacingTokens.length} tokens total.
 */
export const UI_SPACING_TOKENS: readonly TokenDef[] = [
${spacingLines}
];

/**
 * Font tokens from \`packages/ui/styles/tokens.css\`.
 *
 * Coverage: ${manifest.fontTokens.length} tokens total.
 */
export const UI_FONT_TOKENS: readonly TokenDef[] = [
${fontLines}
];

/**
 * Size tokens from \`packages/ui/styles/tokens.css\`.
 *
 * Coverage: ${manifest.sizeTokens.length} tokens total.
 * \`--radius-full\` carries a pill toggle (sentinel 9999px).
 */
export const UI_SIZE_TOKENS: readonly TokenDef[] = [
${sizeLines}
];
`;
}
