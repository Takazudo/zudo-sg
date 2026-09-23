// Token vocabulary and rendering on top of css-var-parser.ts. An optional
// host tokens.spec supplies the vocabulary; the bundled tables remain the
// byte-for-byte compatible default when no spec is configured.
//
// CSS remains the source of default values. Host specs can override derived
// ids/labels and supply presentation metadata absent from CSS.
//
// The tables below were ported from the host's former
// `scripts/lib/ui-token-manifest.mjs`; they describe the bundled demo only.

import { parseCssCustomProperties } from "./css-var-parser.js";
import type { GeneratedTokenGroups, HostTokenSpec, HostTokensSpec, TokenCategory, TokenControl, TokenPreview } from "../../token-spec.js";

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
  units?: string[];
  readonly?: boolean;
  valueKind?: "number";
}

export interface PaletteEntry {
  name: string;
  value: string;
  /** Present for host specs, where names need not start with `--palette-`. */
  cssVar?: string;
  id?: string;
  label?: string;
  group?: string;
  readonly?: boolean;
  note?: string;
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
  /** Present only for a supplied host spec. */
  groups?: GeneratedTokenGroups;
}

const CATEGORIES: TokenCategory[] = ["palette", "color", "spacing", "font", "size"];
const PREVIEWS: TokenPreview[] = ["size", "line-height", "family", "weight", "bar", "radius", "duration"];
const CONTROLS: TokenControl[] = ["slider", "text", "select"];
// Accept numeric-leading and non-ASCII host names while excluding CSS syntax.
const CSS_VAR_RE = /^--[A-Za-z0-9_\u{80}-\u{10FFFF}][A-Za-z0-9_\u{80}-\u{10FFFF}-]*$/u;
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

function specError(path: string, detail: string): never {
  throw new Error(`[zudo-sg] tokens.spec${path ? `.${path}` : ""}: ${detail}`);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) specError(path, "expected a non-empty string");
  return value;
}

function optionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string") specError(path, "expected a string");
}

function validateToken(token: unknown, path: string, category: TokenCategory): asserts token is HostTokenSpec {
  if (!record(token)) specError(path, "expected a token object");
  const fields = ["cssVar", "id", "label", "control", "valueKind", "step", "unit", "units", "options", "readonly", "pill", "note"];
  for (const key of Object.keys(token)) if (!fields.includes(key)) specError(`${path}.${key}`, "unknown token field");
  const cssVar = nonempty(token.cssVar, `${path}.cssVar`);
  if (!CSS_VAR_RE.test(cssVar)) specError(`${path}.cssVar`, `invalid CSS custom property ${JSON.stringify(cssVar)}`);
  if (token.id !== undefined && !ID_RE.test(nonempty(token.id, `${path}.id`))) specError(`${path}.id`, "expected an id starting with a letter, followed by letters, numbers, '_' or '-'");
  if (token.label !== undefined) nonempty(token.label, `${path}.label`);
  if (token.control !== undefined && !CONTROLS.includes(token.control as TokenControl)) specError(`${path}.control`, `unsupported control ${JSON.stringify(token.control)}`);
  if (token.valueKind !== undefined && token.valueKind !== "number") specError(`${path}.valueKind`, "only 'number' is supported");
  if (token.valueKind === "number" && (token.control === "text" || token.control === "select" || (token.unit !== undefined && (typeof token.unit !== "string" || !["", "ms", "s"].includes(token.unit))))) specError(`${path}.valueKind`, "number requires a slider token with no unit or a duration unit (ms/s)");
  if (category === "color" && token.valueKind === "number" && token.control !== "slider") specError(`${path}.valueKind`, "color tokens default to text; set control: 'slider' for a number row");
  if (category === "palette" && token.control !== undefined) specError(`${path}.control`, "palette colors use the color editor; omit control");
  if (category === "palette" && ["step", "unit", "units", "options", "pill", "valueKind"].some((key) => token[key] !== undefined)) specError(path, "palette colors accept only cssVar, id, label, readonly and note");
  if (token.step !== undefined && (typeof token.step !== "number" || !Number.isFinite(token.step) || token.step <= 0)) specError(`${path}.step`, "expected a positive finite number");
  for (const key of ["unit", "note"] as const) optionalString(token[key], `${path}.${key}`);
  if (token.readonly !== undefined && typeof token.readonly !== "boolean") specError(`${path}.readonly`, "expected a boolean");
  if (token.options !== undefined) {
    if (!Array.isArray(token.options) || token.options.length === 0 || token.options.some((o) => typeof o !== "string" || !o.trim()) || new Set(token.options).size !== token.options.length) specError(`${path}.options`, "expected unique, non-empty string options");
    if (token.control !== "select") specError(`${path}.options`, "options require control: 'select'");
  }
  if (token.control === "select" && token.options === undefined) specError(`${path}.options`, "select requires options");
  if (token.units !== undefined) {
    if (!Array.isArray(token.units) || token.units.length === 0 || token.units.some((u) => typeof u !== "string") || new Set(token.units).size !== token.units.length) specError(`${path}.units`, "expected unique string units");
    if (token.control !== "slider" && token.control !== undefined) specError(`${path}.units`, "units require a slider control");
    if (token.valueKind === "number") specError(`${path}.units`, "number rows cannot have units");
    if (token.unit === undefined) specError(`${path}.unit`, "unit is required when units are listed");
    if (token.unit !== undefined && !token.units.includes(token.unit)) specError(`${path}.unit`, "unit must appear in units");
  }
  if (token.pill !== undefined) {
    if (token.control === "text" || token.control === "select" || category === "color" && token.control !== "slider") specError(`${path}.pill`, "pill requires a slider control");
    if (!record(token.pill)) specError(`${path}.pill`, "expected { value, customDefault }");
    nonempty(token.pill.value, `${path}.pill.value`);
    nonempty(token.pill.customDefault, `${path}.pill.customDefault`);
  }
}

function buildHostManifest(spec: HostTokensSpec, tokenVars: Map<string, string>, colorVars: Map<string, string>): UiTokenManifest {
  if (!record(spec)) specError("", "expected an object of category group arrays");
  for (const key of Object.keys(spec)) if (!CATEGORIES.includes(key as TokenCategory)) specError(key, "unknown category");
  const groups: GeneratedTokenGroups = { palette: [], color: [], spacing: [], font: [], size: [] };
  const result: UiTokenManifest = { paletteColors: [], colorTokens: [], spacingTokens: [], fontTokens: [], sizeTokens: [], groups };
  const usedIds = new Map<string, string>();
  const usedVars = new Map<string, string>();
  for (const category of CATEGORIES) {
    const entries = spec[category] === undefined ? [] : spec[category];
    if (!Array.isArray(entries)) specError(category, "expected an ordered array of groups");
    const groupIds = new Set<string>();
    entries.forEach((group, groupIndex) => {
      const path = `${category}[${groupIndex}]`;
      if (!record(group)) specError(path, "expected a group object");
      for (const key of Object.keys(group)) if (!["id", "label", "tokens", "preview", "previewBase"].includes(key)) specError(`${path}.${key}`, "unknown group field");
      const groupId = nonempty(group.id, `${path}.id`);
      if (!ID_RE.test(groupId)) specError(`${path}.id`, "invalid group id");
      if (groupIds.has(groupId)) specError(`${path}.id`, `duplicate group id ${JSON.stringify(groupId)}`);
      groupIds.add(groupId);
      const label = nonempty(group.label, `${path}.label`);
      if (!Array.isArray(group.tokens)) specError(`${path}.tokens`, "expected an ordered array of tokens");
      if (group.preview !== undefined && !PREVIEWS.includes(group.preview as TokenPreview)) specError(`${path}.preview`, `unsupported preview ${JSON.stringify(group.preview)}`);
      if (group.previewBase !== undefined) {
        if (group.preview !== "line-height") specError(`${path}.previewBase`, "previewBase requires preview: 'line-height'");
        if (typeof group.previewBase !== "string" || !CSS_VAR_RE.test(group.previewBase)) specError(`${path}.previewBase`, "expected a CSS custom property");
        if (!tokenVars.has(group.previewBase) && !colorVars.has(group.previewBase)) specError(`${path}.previewBase`, `${group.previewBase} was not found in either configured CSS file`);
      }
      groups[category].push({ id: groupId, label, ...(group.preview ? { preview: group.preview } : {}), ...(group.previewBase ? { previewBase: group.previewBase } : {}) });
      const kinds = new Set<string>();
      group.tokens.forEach((rawToken, tokenIndex) => {
        const tokenPath = `${path}.tokens[${tokenIndex}]`;
        validateToken(rawToken, tokenPath, category);
        const control = rawToken.control ?? (category === "color" ? "text" : "slider");
        const kind = category === "palette" ? "color" : control === "select" ? "select" : control === "text" ? "text" : rawToken.valueKind === "number" || group.preview === "line-height" || (group.preview === "weight" && (rawToken.unit ?? "") === "") ? "number" : "length";
        kinds.add(kind);
        if (kinds.size > 1) specError(`${path}.tokens`, "a group must use one value kind for all rows");
        const allowed: Record<TokenPreview, string[]> = { size: ["length"], "line-height": ["number"], family: ["text"], weight: ["select", "number"], bar: ["length"], radius: ["length"], duration: ["length", "number"] };
        if (group.preview && !allowed[group.preview as TokenPreview].includes(kind)) specError(`${path}.preview`, `${group.preview} does not support ${kind} rows`);
        if ((group.preview === "line-height" || group.preview === "weight") && kind === "number" && ((rawToken.unit ?? "") !== "" || rawToken.units !== undefined)) specError(`${path}.preview`, `${group.preview} requires unitless number tokens`);
        if (group.preview === "duration" && !["ms", "s"].includes(rawToken.unit ?? "")) specError(`${path}.preview`, "duration requires ms or s units");
        const cssVar = rawToken.cssVar;
        const id = rawToken.id ?? idOf(cssVar);
        const oldVar = usedVars.get(cssVar);
        if (oldVar) specError(`${tokenPath}.cssVar`, `${cssVar} is already used by ${oldVar}`);
        const oldId = usedIds.get(id);
        if (oldId) specError(`${tokenPath}.id`, `${id} collides with ${oldId}; set a distinct id`);
        usedIds.set(id, tokenPath);
        usedVars.set(cssVar, tokenPath);
        const sourceVars = category === "palette" || category === "color" ? colorVars : tokenVars;
        if (!sourceVars.has(cssVar)) specError(`${tokenPath}.cssVar`, `${cssVar} was not found in the configured ${category === "palette" || category === "color" ? "colors" : "tokens"} CSS file`);
        const value = sourceVars.get(cssVar)!;
        if (category === "palette") {
          result.paletteColors.push({ name: cssVar.slice(2), cssVar, id, label: rawToken.label ?? labelOf(cssVar), group: groupId, value, ...(rawToken.readonly ? { readonly: true } : {}), ...(rawToken.note ? { note: rawToken.note } : {}) });
        } else {
          const built: BuiltToken = { id, cssVar, label: rawToken.label ?? labelOf(cssVar), group: groupId, default: value,
            step: rawToken.step ?? 1, unit: rawToken.unit ?? "", ...(rawToken.control || category === "color" ? { control } : {}),
            ...(rawToken.units ? { units: rawToken.units } : {}), ...(rawToken.options ? { options: rawToken.options } : {}),
            ...(rawToken.pill ? { pill: rawToken.pill } : {}), ...(rawToken.note ? { note: rawToken.note } : {}),
            ...(kind === "number" ? { valueKind: "number" as const } : {}),
            ...(rawToken.readonly ? { readonly: true } : {}) };
          result[`${category}Tokens` as "colorTokens" | "spacingTokens" | "fontTokens" | "sizeTokens"].push(built);
        }
      });
    });
  }
  return result;
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
export function buildUiTokenManifest({ tokensCss, colorsCss, spec }: { tokensCss: string; colorsCss: string; spec?: HostTokensSpec }): UiTokenManifest {
  const tokenVars = parseCssCustomProperties(tokensCss);
  const colorVars = parseCssCustomProperties(colorsCss);
  if (spec !== undefined) return buildHostManifest(spec, tokenVars, colorVars);
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

function renderTokenDefObject(token: BuiltToken, indent: number, custom = false): string {
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
    fields.push(custom ? `options: ${JSON.stringify(token.options)}` : `options: FONT_WEIGHT_OPTIONS`);
  }
  if (custom && token.units) fields.push(`units: ${JSON.stringify(token.units)}`);
  if (custom && token.readonly) fields.push("readonly: true");
  if (custom && token.valueKind) fields.push(`valueKind: ${jsStringLiteral(token.valueKind)}`);
  if (custom && token.note) fields.push(`note: ${jsStringLiteral(token.note)}`);
  if (token.pill) {
    fields.push(
      `pill: { value: ${jsStringLiteral(token.pill.value)}, customDefault: ${jsStringLiteral(token.pill.customDefault)} }`,
    );
  }
  const body = fields.map((f) => `${pad}  ${f},`).join("\n");
  const note = !custom && token.note ? `${pad}// ${token.note}\n` : "";
  return `${note}${pad}{\n${body}\n${pad}},`;
}

function renderPaletteEntry(entry: PaletteEntry, custom = false): string {
  if (custom) return `  ${JSON.stringify(entry)},`;
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
  const custom = manifest.groups !== undefined;
  const paletteLines = manifest.paletteColors.map((entry) => renderPaletteEntry(entry, custom)).join("\n");
  const colorLines = manifest.colorTokens.map((t) => renderTokenDefObject(t, 2, custom)).join("\n");
  const spacingLines = manifest.spacingTokens.map((t) => renderTokenDefObject(t, 2, custom)).join("\n");
  const fontLines = manifest.fontTokens.map((t) => renderTokenDefObject(t, 2, custom)).join("\n");
  const sizeLines = manifest.sizeTokens.map((t) => renderTokenDefObject(t, 2, custom)).join("\n");

  const rendered = `/**
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
  if (!custom) return rendered;
  // Keep the legacy source byte-for-byte while custom specs get truthful prose.
  return `/**
 * Design-token manifest generated by \`zudo-sg gen-token-manifest\`.
 * Run \`zudo-sg gen-token-manifest --check\` to detect drift.
 * CSS declarations in ${sourceOfTruth} supply default values.
 * Host \`tokens.spec\` supplies ordered groups and presentation metadata.
 */
import type { TokenDef } from "@takazudo/zdtp";
import type { GeneratedTokenGroups } from "@takazudo/zudo-sg/config";

/** Number rows are a portable tier-model extension of zdtp's TokenDef. */
export type HostGeneratedToken = TokenDef & { valueKind?: "number"; note?: string };

/** Palette entries preserve explicit host CSS names and group identity. */
export interface UiPaletteColor {
  name: string;
  value: string;
  cssVar: string;
  id: string;
  label: string;
  group: string;
  readonly?: boolean;
  note?: string;
}

export const UI_PALETTE_COLORS: readonly UiPaletteColor[] = [
${paletteLines}
];

export const UI_COLOR_TOKENS: readonly HostGeneratedToken[] = [
${colorLines}
];

export const UI_SPACING_TOKENS: readonly HostGeneratedToken[] = [
${spacingLines}
];

export const UI_FONT_TOKENS: readonly HostGeneratedToken[] = [
${fontLines}
];

export const UI_SIZE_TOKENS: readonly HostGeneratedToken[] = [
${sizeLines}
];

/** Ordered groups for all five categories; omitted categories are empty. */
export const UI_TOKEN_GROUPS: GeneratedTokenGroups = ${JSON.stringify(manifest.groups, null, 2)};
`;
}
