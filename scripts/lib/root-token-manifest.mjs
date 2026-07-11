// scripts/lib/root-token-manifest.mjs
//
// Project-specific layer on top of css-var-resolver.mjs (#209): knows which
// `--custom-properties` reachable from `src/styles/global.css` (the ROOT
// host's own token file, plus the shared @zudo-sg/ui files it @imports)
// belong in `src/config/design-tokens-manifest.ts`, and how to render that
// file. Mirrors scripts/lib/ui-token-manifest.mjs's split, adapted for a
// resolver-backed lookup instead of a single-file Map lookup — this manifest
// spans three source files with real cascade overrides between them (see
// css-var-resolver.mjs and the source order built in
// scripts/gen-root-token-manifest.mjs).
//
// Split rationale (same as ui-token-manifest.mjs): `id`, `label`, and
// `default` are fully derivable from the CSS (the var name + its resolved
// value) — deriving them keeps the manifest impossible to typo out of sync
// with its own cssVar. `group`/`step`/`unit`/`control`/`options`/`pill`/
// `readonly` are presentation metadata with no CSS equivalent — those live in
// the SPECS tables below and are the one thing a human edits when a *new*
// token needs to appear in the panel.
//
// Unit normalization (LOCKED, do not re-litigate — see #210): the hand file
// this generator reproduces expresses radius/duration tokens in px/ms even
// though the CSS declares them in rem/s (see the `--radius-lg: 1rem (16px)`
// vs `0.5rem (8px)` root override, and `--default-transition-duration: 0.15s`
// vs the hand file's `"150ms"`). `normalizeToUnit()` applies the two
// canonical transforms this project uses — rem -> px at 16px/rem, s -> ms —
// driven by each SPECS entry's own target `unit` field, so generated
// defaults preserve the current hand-file unit SHAPES exactly. Values
// already expressed in the target unit (or unitless numbers/strings, e.g.
// line-heights, font-weights, font-family stacks) pass through unchanged.
// zdtp's panel forwards `default` + `unit` as separate fields — a rem value
// carrying `unit: "px"` would be silently wrong at render time, not just a
// cosmetic mismatch, which is why this transform exists at all.
//
// --zd-sidebar-w (sidebar-w) is intentionally NOT looked up via the
// resolver: it's a `clamp(14rem, 20vw, 22rem)` expression, and this
// generator only dereferences whole-value `var()` chains and literals —
// clamp() math is out of scope for v1 (see design-tokens-manifest.ts's own
// comment on this row). SIDEBAR_W_MANUAL_TOKEN carries the same literal by
// hand, flagged readonly, exactly as the hand file does today.
//
// COLOR_TOKENS stays empty in v1: `--zd-surface` and its siblings are
// injected by ColorSchemeProvider at runtime and have no static CSS
// declaration anywhere in the three source files — resolveCssVar() would
// correctly report them `unresolved: true`, which this generator treats as
// "don't fake a literal" rather than emitting a `var(--zd-surface)` string.

/**
 * @typedef {import("./css-var-resolver.mjs").CssVarResolution} CssVarResolution
 */

// ---------------------------------------------------------------------------
// id / label derivation — mirrors ui-token-manifest.mjs's suffixOf(), minus
// the "ui-" id prefix (this is the root manifest, not the @zudo-sg/ui one).
// ---------------------------------------------------------------------------

const SPACING_PREFIX = "--spacing-";

/**
 * Strip the leading `--` from a cssVar, except for `--spacing-*` tokens where
 * the `spacing-` segment is also dropped (`--spacing-hsp-2xs` -> `hsp-2xs`) —
 * matches the hand-written manifest's existing id/label shape.
 *
 * `--spacing-0` / `--spacing-px` are the one exception to that stripping
 * rule: the hand file keeps their full `spacing-0` / `spacing-px` ids
 * (unlike the axis-scoped `hsp-*`/`vsp-*`/`icon-*` rows) — presumably so a
 * bare "0" or "px" id doesn't read as a typo. SPECS entries for those two
 * carry an explicit `id`/`label` override consumed by idOf()/labelOf()
 * below rather than special-casing this function further.
 */
function suffixOf(cssVar) {
  if (cssVar.startsWith(SPACING_PREFIX)) {
    return cssVar.slice(SPACING_PREFIX.length);
  }
  return cssVar.slice(2);
}

function idOf(cssVar, override) {
  return override ?? suffixOf(cssVar);
}

function labelOf(cssVar, override) {
  return override ?? suffixOf(cssVar);
}

// ---------------------------------------------------------------------------
// Unit normalization — the two LOCKED canonical transforms (see file header).
// ---------------------------------------------------------------------------

const REM_LITERAL_RE = /^(-?[0-9]*\.?[0-9]+)rem$/;
// Anchored so it never matches an "ms" value: `[0-9.]+` cannot consume the
// "m" in "150ms", so `0.15s` matches but `150ms` does not.
const SEC_LITERAL_RE = /^(-?[0-9]*\.?[0-9]+)s$/;

const REM_TO_PX = 16;
const SEC_TO_MS = 1000;

function formatNumber(n) {
  // Round away float noise (e.g. 0.1 * 1000 -> 100.00000000000001) without
  // reintroducing it via toFixed()'s string padding.
  return String(Math.round(n * 1e6) / 1e6);
}

/**
 * Apply the LOCKED canonical transforms — rem -> px at 16px/rem, s -> ms —
 * only when the resolved CSS literal's unit differs from the spec's declared
 * target `unit`. Anything already in the target unit (`9999px` when
 * `unit: "px"`), or a unitless literal (line-heights, font-weights, raw
 * font-family strings), passes through unchanged.
 *
 * @param {string} rawValue The resolved CSS literal (e.g. "0.5rem", "0.15s").
 * @param {string} targetUnit The SPECS entry's declared `unit` field.
 * @returns {string}
 */
export function normalizeToUnit(rawValue, targetUnit) {
  if (targetUnit === "px") {
    const match = rawValue.match(REM_LITERAL_RE);
    if (match) {
      return `${formatNumber(parseFloat(match[1]) * REM_TO_PX)}px`;
    }
  }
  if (targetUnit === "ms") {
    const match = rawValue.match(SEC_LITERAL_RE);
    if (match) {
      return `${formatNumber(parseFloat(match[1]) * SEC_TO_MS)}ms`;
    }
  }
  return rawValue;
}

// ---------------------------------------------------------------------------
// Specs — one entry per token that should appear in the manifest. `default`
// is intentionally absent here; buildFromSpecs() resolves it from the CSS
// sources (via the resolver) so a value can never drift from its source
// declaration without `pnpm check:root-token-manifest` catching it.
// ---------------------------------------------------------------------------

const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
];

/**
 * Horizontal (hsp) + vertical (vsp) spacing axes and icon sizes from
 * `global.css` (hsp/vsp come from the shared tokens.css it imports; icon
 * sizes and image-overlay-inset are root-specific @theme additions).
 * `spacing-0` / `spacing-px` are structural anchors, flagged readonly —
 * editing them would break every utility that relies on "0 is 0" / the 1px
 * hairline, but their values are still resolvable from the shared CSS.
 *
 * `--zd-sidebar-w` (sidebar-w) is deliberately NOT here — see
 * SIDEBAR_W_MANUAL_TOKEN below.
 */
export const SPACING_SPECS = [
  // --- Horizontal spacing ---
  { cssVar: "--spacing-hsp-2xs", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-xs", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-sm", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-md", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-lg", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-xl", group: "hsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-hsp-2xl", group: "hsp", step: 0.025, unit: "rem" },

  // --- Vertical spacing ---
  { cssVar: "--spacing-vsp-3xs", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-2xs", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-xs", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-sm", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-md", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-lg", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-xl", group: "vsp", step: 0.025, unit: "rem" },
  { cssVar: "--spacing-vsp-2xl", group: "vsp", step: 0.025, unit: "rem" },

  // --- Icons (root-specific @theme additions in global.css) ---
  { cssVar: "--spacing-icon-xs", group: "icon", step: 0.05, unit: "rem" },
  { cssVar: "--spacing-icon-sm", group: "icon", step: 0.05, unit: "rem" },
  { cssVar: "--spacing-icon-md", group: "icon", step: 0.05, unit: "rem" },
  { cssVar: "--spacing-icon-lg", group: "icon", step: 0.05, unit: "rem" },

  // --- Layout ---
  { cssVar: "--spacing-image-overlay-inset", group: "layout", step: 0.05, unit: "rem" },
  // Structural zero / 1px hairline — read-only so designers see they exist,
  // but editing them would break utilities that rely on "0 is 0" / the
  // hairline width. id/label keep the full "spacing-" prefix (unlike the
  // axis-scoped rows above) to match the hand file's existing shape.
  { cssVar: "--spacing-0", id: "spacing-0", label: "spacing-0", group: "layout", step: 1, unit: "", readonly: true },
  { cssVar: "--spacing-px", id: "spacing-px", label: "spacing-px", group: "layout", step: 1, unit: "px", readonly: true },
];

/**
 * `--zd-sidebar-w`: a `clamp(14rem, 20vw, 22rem)` responsive expression, not
 * a single resolvable value — clamp() math is out of scope for this
 * generator (LOCKED per #210). Carried as a manually-flagged readonly
 * literal, exactly matching design-tokens-manifest.ts's existing row, rather
 * than looked up via the resolver.
 */
export const SIDEBAR_W_MANUAL_TOKEN = {
  id: "sidebar-w",
  cssVar: "--zd-sidebar-w",
  label: "sidebar-w",
  group: "layout",
  default: "clamp(14rem, 20vw, 22rem)",
  step: 1,
  unit: "",
  readonly: true,
};

/**
 * Font sizes (Tier 2 semantic aliases onto the shared Tier 1 abstract
 * scale), line-heights, weights, and families. `--leading-snug` is a
 * root-specific @theme addition in global.css (the shared tokens.css omits
 * it); every other line-height/size here resolves through the shared file.
 */
export const FONT_SPECS = [
  // --- Font sizes (Tier 2 semantic) ---
  { cssVar: "--text-micro", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-caption", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-small", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-body", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-heading", group: "font-size", step: 0.05, unit: "rem" },
  { cssVar: "--text-display", group: "font-size", step: 0.05, unit: "rem" },

  // --- Line heights (unitless) ---
  { cssVar: "--leading-tight", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-snug", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-normal", group: "line-height", step: 0.05, unit: "" },
  { cssVar: "--leading-relaxed", group: "line-height", step: 0.05, unit: "" },

  // --- Font weights (select) ---
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

  // --- Font families (text input) ---
  { cssVar: "--font-sans", group: "font-family", step: 1, unit: "", control: "text" },
  { cssVar: "--font-mono", group: "font-family", step: 1, unit: "", control: "text" },
];

/**
 * Radius + transition duration. `--radius-DEFAULT` and `--radius-lg` are
 * root-specific @theme overrides in global.css (denser than the shared
 * tokens.css defaults) resolved in rem, then normalized to px per the
 * hand-file unit shape. `--radius-full`'s CSS literal is already `9999px`
 * (no unit transform fires). `--default-transition-duration` resolves from
 * the shared tokens.css in seconds, normalized to ms.
 */
export const SIZE_SPECS = [
  // --- Radius ---
  { cssVar: "--radius-DEFAULT", group: "radius", step: 1, unit: "px" },
  { cssVar: "--radius-lg", group: "radius", step: 1, unit: "px" },
  {
    cssVar: "--radius-full",
    group: "radius",
    step: 1,
    unit: "px",
    pill: { value: "9999px", customDefault: "16px" },
  },

  // --- Transitions ---
  { cssVar: "--default-transition-duration", group: "transition", step: 10, unit: "ms" },
];

// ---------------------------------------------------------------------------
// Building — resolve each spec's `default` against the css-var-resolver.
// ---------------------------------------------------------------------------

/**
 * @param {{ resolveCssVar: (name: string) => CssVarResolution }} resolver
 * @param {string} cssVar
 * @param {string} targetUnit
 * @returns {string}
 */
export function lookup(resolver, cssVar, targetUnit) {
  const resolution = resolver.resolveCssVar(cssVar);
  if (resolution.unresolved) {
    throw new Error(
      `${cssVar} could not be resolved to a literal from the three root CSS sources ` +
        `(chain: ${resolution.chain.join(" -> ")}). Either the token was renamed/removed ` +
        "(update the spec in scripts/lib/root-token-manifest.mjs), or it references a " +
        "runtime-injected var (like --zd-surface) that has no static declaration — such " +
        "tokens belong in COLOR_TOKENS (kept empty in v1), not here.",
    );
  }
  return normalizeToUnit(resolution.value, targetUnit);
}

/**
 * @param {Array<Record<string, unknown>>} specs
 * @param {{ resolveCssVar: (name: string) => CssVarResolution }} resolver
 */
export function buildFromSpecs(specs, resolver) {
  return specs.map(({ cssVar, id, label, group, step, unit, control, options, pill, readonly }) => ({
    id: idOf(cssVar, id),
    cssVar,
    label: labelOf(cssVar, label),
    group,
    default: lookup(resolver, cssVar, unit),
    step,
    unit,
    ...(control ? { control } : {}),
    ...(options ? { options } : {}),
    ...(pill ? { pill } : {}),
    ...(readonly ? { readonly: true } : {}),
  }));
}

/**
 * Build the full root token manifest data — the same shape as the arrays
 * exported by `src/config/design-tokens-manifest.ts`, minus the TS syntax.
 *
 * @param {{ resolveCssVar: (name: string) => CssVarResolution }} resolver
 *   Built by the caller over the ordered three CSS sources — see the
 *   call-site comment in scripts/gen-root-token-manifest.mjs for why that
 *   order MUST track global.css's own @import lines.
 */
export function buildRootTokenManifest(resolver) {
  return {
    spacingTokens: [...buildFromSpecs(SPACING_SPECS, resolver), SIDEBAR_W_MANUAL_TOKEN],
    fontTokens: buildFromSpecs(FONT_SPECS, resolver),
    sizeTokens: buildFromSpecs(SIZE_SPECS, resolver),
    // v1: --zd-surface and its siblings are runtime-injected (no static CSS
    // declaration to resolve) — kept empty rather than faking a literal.
    // See design-tokens-manifest.ts's own COLOR_TOKENS comment.
    colorTokens: [],
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
  if (token.readonly) fields.push(`readonly: true`);
  const body = fields.map((f) => `${pad}  ${f},`).join("\n");
  return `${pad}{\n${body}\n${pad}},`;
}

/**
 * Render the full `src/config/root-token-manifest.generated.ts` source.
 *
 * @param {ReturnType<typeof buildRootTokenManifest>} manifest
 */
export function renderRootTokenManifestFile(manifest) {
  const spacingLines = manifest.spacingTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const fontLines = manifest.fontTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");
  const sizeLines = manifest.sizeTokens.map((t) => renderTokenDefObject(t, 2)).join("\n");

  return `/**
 * Design-token manifest for the zudo-sg ROOT host — GENERATE-ONLY scratch
 * output (#210). NOT wired into any consumer yet; the hand-maintained
 * src/config/design-tokens-manifest.ts is still the manifest the panel and
 * serde actually use. This file exists as generator evidence for the
 * follow-up wire-in sub-issue.
 *
 * GENERATED — do not hand-edit. Run
 * \`node scripts/gen-root-token-manifest.mjs\` after changing
 * packages/ui/styles/tokens.css, packages/ui/styles/colors.css, or
 * src/styles/global.css, then commit the regenerated output.
 * \`node scripts/gen-root-token-manifest.mjs --check\` fails on drift.
 *
 * Source of truth, resolved via scripts/lib/css-var-resolver.mjs (#209) in
 * @import cascade order — this order MUST track global.css's own @import
 * lines, see the call-site comment in scripts/gen-root-token-manifest.mjs:
 *   1. packages/ui/styles/tokens.css  (shared spacing/font/radius/shadow/transition)
 *   2. packages/ui/styles/colors.css  (shared semantic colors — no spacing/font/size tokens)
 *   3. src/styles/global.css itself   (root-specific @theme/:root overrides win on collision,
 *                                       e.g. --radius-lg, --radius-DEFAULT, --leading-snug,
 *                                       --spacing-icon-*)
 *
 * Only \`default\` values are derived from the CSS. The two LOCKED canonical
 * unit transforms (rem -> px at 16px/rem, s -> ms) are applied per-token so
 * generated defaults preserve the current hand-file unit SHAPES exactly
 * (e.g. --radius-lg -> "8px", --default-transition-duration -> "150ms").
 * \`group\`/\`step\`/\`unit\`/\`control\`/\`options\`/\`pill\`/\`readonly\` are
 * presentation metadata with no CSS equivalent and are configured in this
 * script's SPECS tables (scripts/lib/root-token-manifest.mjs).
 *
 * \`sidebar-w\` (--zd-sidebar-w) is a manually-flagged readonly literal, not
 * derived from CSS — its clamp() expression is out of scope for this
 * generator (see scripts/lib/root-token-manifest.mjs).
 *
 * COLOR_TOKENS is intentionally empty (v1): --zd-surface and its siblings
 * are injected by ColorSchemeProvider at runtime and have no static CSS
 * declaration anywhere in the three source files to resolve.
 */
import type { TokenDef } from "@takazudo/zdtp";

// --- Font weight select options ---
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

/**
 * Spacing tokens from \`global.css\` (hsp/vsp/spacing-0/spacing-px come from
 * the shared tokens.css it imports; icon sizes, image-overlay-inset, and
 * sidebar-w are root-specific).
 *
 * Coverage: ${manifest.spacingTokens.length} tokens total.
 */
export const SPACING_TOKENS: readonly TokenDef[] = [
${spacingLines}
];

/**
 * Font tokens from \`global.css\` and the shared tokens.css it imports.
 *
 * Coverage: ${manifest.fontTokens.length} tokens total.
 */
export const FONT_TOKENS: readonly TokenDef[] = [
${fontLines}
];

/**
 * Size tokens (radius + transition) from \`global.css\` and the shared
 * tokens.css it imports.
 *
 * Coverage: ${manifest.sizeTokens.length} tokens total.
 * \`radius-full\` carries a pill toggle (sentinel 9999px).
 */
export const SIZE_TOKENS: readonly TokenDef[] = [
${sizeLines}
];

/**
 * Color tokens — intentionally empty (v1). See file header.
 */
export const COLOR_TOKENS: readonly TokenDef[] = [];
`;
}
