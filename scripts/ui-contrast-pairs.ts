/**
 * scripts/ui-contrast-pairs.ts
 *
 * WCAG contrast audit for the @zudo-sg/ui grouped-palette semantic tokens
 * (packages/ui/styles/colors.css). Complements contrast-pair-matrix.ts, which
 * audits the host doc-chrome `--zd-*` scheme resolved from color-schemes.ts.
 *
 * The ui palette's values live in CSS (Tier-1 `--palette-*` rungs + Tier-2
 * `--color-*` light-dark() / single-value tokens), NOT in color-schemes.ts, so
 * this module parses colors.css directly (same postcss parser the token
 * manifest uses) and resolves each semantic token's light + dark side back to a
 * raw oklch literal before running the same WCAG math.
 *
 * Coverage: the locked neutral text roles, links and their actual tinted
 * `color-mix()` backgrounds, on-accent labels for every filled action/state,
 * focus indicators, the persistent dark `rail` surface (scheme-independent),
 * and the five business-line accents (raw Tier-1 rungs consumed later by the
 * port batches' `[data-line]` overrides). Forced light and dark schemes are
 * evaluated separately. Text pairs meet AA (or AAA for `fg`); focus/non-text
 * indicators meet 3:1.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseCss } from "postcss";
import { formatCss, interpolate } from "culori";

import { parseCssCustomProperties } from "./lib/css-var-parser.mjs";
import { colorMixSrgb, contrastRatio } from "../src/config/contrast-utils";
import type { PairResult, SchemeReport } from "./contrast-pair-matrix";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLORS_CSS_PATH = resolve(__dirname, "../packages/ui/styles/colors.css");
const SYNTAX_CSS_PATH = resolve(__dirname, "../packages/ui/styles/syntax-highlight.css");
const PREVIEW_CSS_PATH = resolve(__dirname, "../src/styles/preview.css");
const PROSE_MD_CSS_PATH = resolve(__dirname, "../packages/ui/src/content/prose-md/prose-md.css");

export type Mode = "light" | "dark";

const LINE_KEYS = ["vacuum", "process", "laser", "meeting", "beauty"] as const;

function loadVars(): Map<string, string> {
  const vars = parseCssCustomProperties(readFileSync(COLORS_CSS_PATH, "utf8"));
  for (const [name, value] of parseCssCustomProperties(readFileSync(SYNTAX_CSS_PATH, "utf8"))) {
    vars.set(name, value);
  }
  return vars;
}

/** Split a function's arguments without treating nested function commas as separators. */
function splitFunctionArgs(input: string): string[] {
  const args: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: string | undefined;
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quote !== undefined) {
      if (char === quote && input[i - 1] !== "\\") quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth < 0) throw new Error(`ui contrast audit: unbalanced color expression "${input}"`);
    } else if (char === "," && depth === 0) {
      args.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (quote !== undefined || depth !== 0) {
    throw new Error(`ui contrast audit: unbalanced color expression "${input}"`);
  }
  args.push(input.slice(start).trim());
  return args;
}

function functionArgs(expr: string, name: string): string[] | undefined {
  const prefix = `${name}(`;
  if (!expr.toLowerCase().startsWith(prefix)) return undefined;
  if (!expr.endsWith(")")) throw new Error(`ui contrast audit: malformed ${name}() expression "${expr}"`);
  return splitFunctionArgs(expr.slice(prefix.length, -1));
}

interface VarCall {
  name: string;
  fallback?: string;
}

function parseVarCall(expr: string): VarCall | undefined {
  const args = functionArgs(expr, "var");
  if (args === undefined) return undefined;
  if (args.length < 1 || args.length > 2 || !/^--[a-z0-9_-]+$/i.test(args[0]!)) {
    throw new Error(`ui contrast audit: malformed var() expression "${expr}"`);
  }
  return { name: args[0]!, fallback: args[1] };
}

interface ColorStop {
  expr: string;
  weight?: number;
}

/** Parse one color-mix stop, whose optional percentage is the final token. */
function parseColorStop(raw: string): ColorStop {
  const match = /^(.*?)(?:\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)%))?$/.exec(raw.trim());
  if (!match || !match[1]!.trim()) throw new Error(`ui contrast audit: malformed color-mix stop "${raw}"`);
  return {
    expr: match[1]!.trim(),
    weight: match[2] === undefined ? undefined : Number.parseFloat(match[2]),
  };
}

/** Resolve an OKLCH color-mix with CSS's omitted-weight semantics. */
function resolveColorMix(args: string[], vars: Map<string, string>, mode: Mode, chain: string[]): string {
  if (args.length !== 3 || !/^in\s+oklch(?:\s|$)/i.test(args[0]!)) {
    throw new Error(`ui contrast audit: only two-color color-mix(in oklch, …) is supported`);
  }
  const first = parseColorStop(args[1]!);
  const second = parseColorStop(args[2]!);
  let firstWeight: number;
  let secondWeight: number;
  if (first.weight === undefined && second.weight === undefined) {
    firstWeight = 50;
    secondWeight = 50;
  } else if (first.weight === undefined) {
    secondWeight = second.weight!;
    firstWeight = 100 - secondWeight;
  } else if (second.weight === undefined) {
    firstWeight = first.weight;
    secondWeight = 100 - firstWeight;
  } else {
    firstWeight = first.weight;
    secondWeight = second.weight;
  }
  const total = firstWeight + secondWeight;
  if (!(total > 0)) throw new Error(`ui contrast audit: color-mix() has no positive color weight`);

  const firstColor = resolveRef(first.expr, vars, mode, chain);
  const secondColor = resolveRef(second.expr, vars, mode, chain);
  const interpolator = interpolate([firstColor, secondColor], "oklch");
  const mixed = interpolator(secondWeight / total);
  if (!mixed) throw new Error(`ui contrast audit: could not parse color-mix() colors`);
  return formatCss(mixed);
}

/**
 * Resolve the CSS color expression used by the UI token sources.
 *
 * This intentionally follows CSS custom-property fallback semantics instead
 * of replacing the real source with a precomputed color: a missing or invalid
 * first branch of `var(--x, fallback)` selects the fallback, nested `var()`
 * calls are followed, `light-dark()` selects the active side, and
 * `color-mix(in oklch, …)` is interpolated in OKLCH (never sRGB).
 */
export function resolveRef(
  expr: string,
  vars: Map<string, string>,
  mode: Mode = "light",
  chain: string[] = [],
): string {
  const trimmed = expr.trim();
  const varCall = parseVarCall(trimmed);
  if (varCall !== undefined) {
    if (chain.includes(varCall.name)) {
      throw new Error(`ui contrast audit: cyclic var() reference (${[...chain, varCall.name].join(" -> ")})`);
    }
    const value = vars.get(varCall.name);
    if (value === undefined) {
      if (varCall.fallback !== undefined) return resolveRef(varCall.fallback, vars, mode, chain);
      throw new Error(`ui contrast audit: palette ref "${varCall.name}" not found in source CSS`);
    }
    try {
      return resolveRef(value, vars, mode, [...chain, varCall.name]);
    } catch (error) {
      if (varCall.fallback !== undefined) return resolveRef(varCall.fallback, vars, mode, chain);
      throw error;
    }
  }

  const lightDarkArgs = functionArgs(trimmed, "light-dark");
  if (lightDarkArgs !== undefined) {
    if (lightDarkArgs.length !== 2) throw new Error(`ui contrast audit: malformed light-dark() expression "${expr}"`);
    return resolveRef(lightDarkArgs[mode === "light" ? 0 : 1]!, vars, mode, chain);
  }

  const colorMixArgs = functionArgs(trimmed, "color-mix");
  if (colorMixArgs !== undefined) return resolveColorMix(colorMixArgs, vars, mode, chain);

  return trimmed;
}

/** Resolve a Tier-2 `--color-<token>` to its {light, dark} literals. */
export function sides(token: string, vars: Map<string, string>): { light: string; dark: string } {
  const raw = vars.get(`--color-${token}`);
  if (raw === undefined) {
    throw new Error(`ui contrast audit: --color-${token} not found in colors.css`);
  }
  const lightDarkArgs = functionArgs(raw, "light-dark");
  if (lightDarkArgs !== undefined) {
    if (lightDarkArgs.length !== 2) throw new Error(`ui contrast audit: malformed light-dark() expression "${raw}"`);
    return {
      light: resolveRef(lightDarkArgs[0]!, vars, "light"),
      dark: resolveRef(lightDarkArgs[1]!, vars, "dark"),
    };
  }
  // Single-value (scheme-independent, e.g. rail-*): same on both sides.
  const light = resolveRef(raw, vars, "light");
  const dark = resolveRef(raw, vars, "dark");
  return { light, dark };
}

function palette(name: string, vars: Map<string, string>): string {
  const value = vars.get(`--palette-${name}`);
  if (value === undefined) {
    throw new Error(`ui contrast audit: --palette-${name} not found in colors.css`);
  }
  return value.trim();
}

/** Merge the package palette with the real styleguide preview scope. */
export function loadPreviewVars(): Map<string, string> {
  const vars = loadVars();
  for (const [name, value] of parseCssCustomProperties(readFileSync(PREVIEW_CSS_PATH, "utf8"))) {
    vars.set(name, value);
  }
  return vars;
}

/** Resolve a custom property from the merged preview source for one scheme. */
export function resolvePreviewVar(name: string, mode: Mode, vars = loadPreviewVars()): string {
  const value = vars.get(name);
  if (value === undefined) throw new Error(`ui contrast audit: preview token "${name}" not found in source CSS`);
  return resolveRef(value, vars, mode);
}

/** Read the actual `.zc-prose-md pre` background declaration from package CSS. */
export function loadProseMdPreBackground(): string {
  const root = parseCss(readFileSync(PROSE_MD_CSS_PATH, "utf8"));
  let background: string | undefined;
  root.walkRules((rule) => {
    if (rule.selector !== ".zc-prose-md pre") return;
    rule.walkDecls("background-color", (decl) => {
      background = decl.value.trim();
    });
  });
  if (background === undefined) {
    throw new Error(`ui contrast audit: .zc-prose-md pre background-color not found in prose-md.css`);
  }
  return background;
}

const STANDALONE_SYNTAX_ALIASES = [
  ["comment", "muted"],
  ["string", "success"],
  ["number", "warning"],
  ["keyword", "accent"],
  ["callable", "info"],
  ["type", "warning"],
  ["name", "fg"],
  ["inserted", "success"],
  ["deleted", "danger"],
] as const;

function standalonePreSpecs(mode: Mode, vars: Map<string, string>): Array<{ key: string; label: string; fg: string; bg: string; threshold: number }> {
  // The external package path owns --zfb-hi-bg directly; no doc-system bridge
  // participates in resolving the component's real background declaration.
  const preBackground = resolveRef(loadProseMdPreBackground(), vars, mode);
  const specs = [{
    key: "prose-md-pre-fg-vs-standalone-background",
    label: "standalone ProseMd pre fg / fallback fence background",
    fg: sides("fg", vars)[mode],
    bg: preBackground,
    threshold: 4.5,
  }];
  specs.push(...STANDALONE_SYNTAX_ALIASES.map(([role, token]) => ({
    key: `prose-md-pre-${role}-vs-standalone-background`,
    label: `standalone ProseMd pre ${role} / fallback fence background`,
    fg: sides(token, vars)[mode],
    bg: preBackground,
    threshold: 4.5,
  })));
  return specs;
}

function evaluateMode(mode: Mode, vars: Map<string, string>): SchemeReport {
  const s = (token: string) => sides(token, vars)[mode];
  const bg = s("bg");
  const surface = s("surface");
  const surface2 = s("surface-2");

  const specs: Array<{ key: string; label: string; fg: string; bg: string; threshold: number }> = [
    { key: "fg-vs-bg", label: "fg / bg", fg: s("fg"), bg, threshold: 7 },
    { key: "fg-vs-surface", label: "fg / surface", fg: s("fg"), bg: surface, threshold: 7 },
    { key: "fg-vs-surface-2", label: "fg / surface-2", fg: s("fg"), bg: surface2, threshold: 7 },
    { key: "muted-vs-bg", label: "muted / bg", fg: s("muted"), bg, threshold: 4.5 },
    { key: "muted-vs-surface", label: "muted / surface", fg: s("muted"), bg: surface, threshold: 4.5 },
    { key: "muted-vs-surface-2", label: "muted / surface-2", fg: s("muted"), bg: surface2, threshold: 4.5 },
    { key: "accent-vs-bg", label: "accent / bg", fg: s("accent"), bg, threshold: 4.5 },
    { key: "accent-vs-surface", label: "accent / surface", fg: s("accent"), bg: surface, threshold: 4.5 },
    {
      key: "accent-vs-accent-tint",
      label: "accent / 12% accent tint",
      fg: s("accent"),
      bg: colorMixSrgb(s("accent"), bg, 12),
      threshold: 4.5,
    },
    { key: "accent-hover-vs-bg", label: "accentHover / bg", fg: s("accent-hover"), bg, threshold: 4.5 },
    { key: "on-accent-vs-accent", label: "onAccent / accent", fg: s("on-accent"), bg: s("accent"), threshold: 4.5 },
    { key: "on-accent-vs-accent-hover", label: "onAccent / accentHover", fg: s("on-accent"), bg: s("accent-hover"), threshold: 4.5 },
    { key: "on-accent-vs-success", label: "onAccent / success", fg: s("on-accent"), bg: s("success"), threshold: 4.5 },
    { key: "on-accent-vs-danger", label: "onAccent / danger", fg: s("on-accent"), bg: s("danger"), threshold: 4.5 },
    { key: "on-accent-vs-warning", label: "onAccent / warning", fg: s("on-accent"), bg: s("warning"), threshold: 4.5 },
    { key: "on-accent-vs-info", label: "onAccent / info", fg: s("on-accent"), bg: s("info"), threshold: 4.5 },
    { key: "focus-vs-bg", label: "focus / bg", fg: s("focus"), bg, threshold: 3 },
    { key: "focus-vs-surface", label: "focus / surface", fg: s("focus"), bg: surface, threshold: 3 },
    { key: "focus-vs-surface-2", label: "focus / surface-2", fg: s("focus"), bg: surface2, threshold: 3 },
  ];

  // Keep the component's provider-owned source in the gate and measure every
  // highlighted role against that standalone fence surface.
  specs.push(...standalonePreSpecs(mode, vars));

  for (const [name, railBg] of [
    ["rail-bg", s("rail-bg")],
    ["rail-bg-strong", s("rail-bg-strong")],
    ["rail-hover-bg", s("rail-hover-bg")],
  ] as const) {
    specs.push({
      key: `rail-fg-vs-${name}`,
      label: `railFg / ${name}`,
      fg: s("rail-fg"),
      bg: railBg,
      threshold: 7,
    });
    specs.push({
      key: `rail-muted-vs-${name}`,
      label: `railMuted / ${name}`,
      fg: s("rail-muted"),
      bg: railBg,
      threshold: 4.5,
    });
  }

  // Business-line accents (raw Tier-1 rungs). Light mode uses the base values;
  // dark mode uses the *-dark rungs. Each is checked as accent-on-bg AND as the
  // fill under an on-accent label (white in light, near-black in dark).
  const onAccent = s("on-accent");
  for (const key of LINE_KEYS) {
    const accent = palette(mode === "light" ? `line-${key}-accent` : `line-${key}-accent-dark`, vars);
    const hover = palette(mode === "light" ? `line-${key}-hover` : `line-${key}-hover-dark`, vars);
    specs.push({ key: `line-${key}-accent-vs-bg`, label: `line-${key} accent / bg`, fg: accent, bg, threshold: 4.5 });
    specs.push({ key: `line-${key}-label-vs-accent`, label: `line-${key} label / accent`, fg: onAccent, bg: accent, threshold: 4.5 });
    specs.push({ key: `line-${key}-hover-vs-bg`, label: `line-${key} hover / bg`, fg: hover, bg, threshold: 4.5 });
  }

  const pairs: PairResult[] = specs.map((spec) => {
    const ratio = contrastRatio(spec.fg, spec.bg);
    return {
      key: spec.key,
      label: spec.label,
      tier: 1,
      threshold: spec.threshold,
      fg: spec.fg,
      bg: spec.bg,
      ratio,
      pass: ratio >= spec.threshold,
    };
  });

  const passCount = pairs.filter((p) => p.pass).length;
  return {
    name: `@zudo-sg/ui (${mode})`,
    source: "uiColors",
    pairs,
    passCount,
    failCount: pairs.length - passCount,
    allPass: passCount === pairs.length,
  };
}

/** Evaluate the @zudo-sg/ui semantic pairs for both schemes. */
export function evaluateUiSchemes(): SchemeReport[] {
  const vars = loadVars();
  return [evaluateMode("light", vars), evaluateMode("dark", vars)];
}
