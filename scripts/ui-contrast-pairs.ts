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
 * Coverage: fg/muted/accent text pairs, on-accent button labels, the four
 * state colors, the persistent dark `rail` surface (scheme-independent), and
 * the five business-line accents (raw Tier-1 rungs consumed later by the port
 * batches' `[data-line]` overrides — audited here as accent-on-bg + label-on-
 * accent for both schemes). All text/accent pairs require AA ≥ 4.5:1.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCssCustomProperties } from "./lib/css-var-parser.mjs";
import { contrastRatio } from "../src/config/contrast-utils";
import type { PairResult, SchemeReport } from "./contrast-pair-matrix";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLORS_CSS_PATH = resolve(__dirname, "../packages/ui/styles/colors.css");

type Mode = "light" | "dark";

const LINE_KEYS = ["vacuum", "process", "laser", "meeting", "beauty"] as const;

function loadVars(): Map<string, string> {
  return parseCssCustomProperties(readFileSync(COLORS_CSS_PATH, "utf8"));
}

/** Resolve a `var(--palette-…)` reference (or a bare literal) to its oklch value. */
function resolveRef(expr: string, vars: Map<string, string>): string {
  const trimmed = expr.trim();
  const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(trimmed);
  if (!m) return trimmed;
  const value = vars.get(m[1]!);
  if (value === undefined) {
    throw new Error(`ui contrast audit: palette ref "${m[1]}" not found in colors.css`);
  }
  return value.trim();
}

/** Resolve a Tier-2 `--color-<token>` to its {light, dark} literals. */
function sides(token: string, vars: Map<string, string>): { light: string; dark: string } {
  const raw = vars.get(`--color-${token}`);
  if (raw === undefined) {
    throw new Error(`ui contrast audit: --color-${token} not found in colors.css`);
  }
  const ld = /^light-dark\(\s*(.+?)\s*,\s*(.+?)\s*\)$/i.exec(raw);
  if (ld) return { light: resolveRef(ld[1]!, vars), dark: resolveRef(ld[2]!, vars) };
  // Single-value (scheme-independent, e.g. rail-*): same on both sides.
  const single = resolveRef(raw, vars);
  return { light: single, dark: single };
}

function palette(name: string, vars: Map<string, string>): string {
  const value = vars.get(`--palette-${name}`);
  if (value === undefined) {
    throw new Error(`ui contrast audit: --palette-${name} not found in colors.css`);
  }
  return value.trim();
}

function evaluateMode(mode: Mode, vars: Map<string, string>): SchemeReport {
  const s = (token: string) => sides(token, vars)[mode];
  const bg = s("bg");
  const surface = s("surface");
  const surface2 = s("surface-2");

  const specs: Array<{ key: string; label: string; fg: string; bg: string; threshold: number }> = [
    { key: "fg-vs-bg", label: "fg / bg", fg: s("fg"), bg, threshold: 4.5 },
    { key: "fg-vs-surface", label: "fg / surface", fg: s("fg"), bg: surface, threshold: 4.5 },
    { key: "fg-vs-surface-2", label: "fg / surface-2", fg: s("fg"), bg: surface2, threshold: 4.5 },
    { key: "muted-vs-bg", label: "muted / bg", fg: s("muted"), bg, threshold: 4.5 },
    { key: "muted-vs-surface", label: "muted / surface", fg: s("muted"), bg: surface, threshold: 4.5 },
    { key: "muted-vs-surface-2", label: "muted / surface-2", fg: s("muted"), bg: surface2, threshold: 4.5 },
    { key: "accent-vs-bg", label: "accent / bg", fg: s("accent"), bg, threshold: 4.5 },
    { key: "accent-vs-surface", label: "accent / surface", fg: s("accent"), bg: surface, threshold: 4.5 },
    { key: "accent-hover-vs-bg", label: "accentHover / bg", fg: s("accent-hover"), bg, threshold: 4.5 },
    { key: "on-accent-vs-accent", label: "onAccent / accent", fg: s("on-accent"), bg: s("accent"), threshold: 4.5 },
    { key: "focus-vs-bg", label: "focus / bg", fg: s("focus"), bg, threshold: 4.5 },
    { key: "success-vs-bg", label: "success / bg", fg: s("success"), bg, threshold: 4.5 },
    { key: "danger-vs-bg", label: "danger / bg", fg: s("danger"), bg, threshold: 4.5 },
    { key: "warning-vs-bg", label: "warning / bg", fg: s("warning"), bg, threshold: 4.5 },
    { key: "info-vs-bg", label: "info / bg", fg: s("info"), bg, threshold: 4.5 },
    // Rail — scheme-independent dark panel; evaluated under both modes.
    { key: "rail-fg-vs-rail-bg", label: "railFg / railBg", fg: s("rail-fg"), bg: s("rail-bg"), threshold: 4.5 },
    { key: "rail-muted-vs-rail-bg", label: "railMuted / railBg", fg: s("rail-muted"), bg: s("rail-bg"), threshold: 4.5 },
    { key: "rail-fg-vs-rail-bg-strong", label: "railFg / railBgStrong", fg: s("rail-fg"), bg: s("rail-bg-strong"), threshold: 4.5 },
  ];

  // Business-line accents (raw Tier-1 rungs). Light mode uses the base rungs;
  // dark mode uses the *-dark rungs. Each is checked as accent-on-bg AND as the
  // fill under an on-accent label (white in light, near-black in dark).
  const onAccent = mode === "light" ? palette("base-0", vars) : palette("base-10", vars);
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
