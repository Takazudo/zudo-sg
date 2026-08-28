/**
 * scripts/contrast-pair-matrix.ts
 *
 * Data-driven pair matrix + evaluation logic for `contrast-audit.ts`.
 * Ported from zudo-doc's scripts/contrast-pair-matrix.ts (feat(a11y):
 * extend contrast guard to full pair matrix, #2492) — see issue #116.
 * PAIR_MATRIX mirrors upstream's finalized matrix; this project has a
 * single `colorSchemes` registry (no `colorTweakPresets`), so the preset
 * source is fixed accordingly.
 */

import { colorSchemes } from "../src/config/color-schemes";
import { schemeToCssPairs } from "../src/config/color-scheme-utils";
import type { ColorScheme } from "../src/config/color-schemes";
import { contrastRatio, colorMixSrgb, ADMONITION_TINT_PCT } from "../src/config/contrast-utils";
import { loadPreviewVars, resolvePreviewVar, type Mode } from "./ui-contrast-pairs";

export type FenceSurface = "doc-page" | "preview";

export interface PairSpec {
  key: string;
  label: string;
  tier: 1 | 2;
  threshold: number;
  fgVar: string;
  bgVar: string;
  tintBg?: true;
  tintPct?: number;
  /** Syntax pairs are evaluated against both source-defined fence surfaces. */
  surface?: FenceSurface;
}

const BASE_PAIR_MATRIX: PairSpec[] = [
  // ── Tier 1 — text, AA ≥ 4.5:1 ──
  { key: "fg-vs-bg", label: "fg / bg", tier: 1, threshold: 4.5, fgVar: "--zd-fg", bgVar: "--zd-bg" },
  { key: "fg-vs-surface", label: "fg / surface", tier: 1, threshold: 4.5, fgVar: "--zd-fg", bgVar: "--zd-surface" },
  { key: "muted-vs-bg", label: "muted / bg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-bg" },
  { key: "muted-vs-surface", label: "muted / surface", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-surface" },
  { key: "muted-vs-code-bg", label: "muted / codeBg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-code-bg" },
  { key: "muted-vs-chat-assistant-bg", label: "muted / chatAssistantBg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-chat-assistant-bg" },
  { key: "accent-vs-bg", label: "accent / bg", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg" },
  { key: "accent-vs-surface", label: "accent / surface", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-surface" },
  { key: "accent-hover-vs-bg", label: "accentHover / bg", tier: 1, threshold: 4.5, fgVar: "--zd-accent-hover", bgVar: "--zd-bg" },
  { key: "code-fg-vs-code-bg", label: "codeFg / codeBg", tier: 1, threshold: 4.5, fgVar: "--zd-code-fg", bgVar: "--zd-code-bg" },
  { key: "admonition-accent", label: "admonition title (note/accent, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-success", label: "admonition title (tip/success, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-success", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-warning", label: "admonition title (warning, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-warning", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-info", label: "admonition title (info, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-info", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-danger", label: "admonition title (danger, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-danger", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-important", label: "admonition title (important/accent, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg", tintBg: true },
  { key: "selection", label: "selectionFg / selectionBg", tier: 1, threshold: 4.5, fgVar: "--zd-selection-fg", bgVar: "--zd-selection-bg" },
  { key: "matched-keyword", label: "matchedKeywordFg / matchedKeywordBg", tier: 1, threshold: 4.5, fgVar: "--zd-matched-keyword-fg", bgVar: "--zd-matched-keyword-bg" },
  { key: "chat-user", label: "chatUserText / chatUserBg", tier: 1, threshold: 4.5, fgVar: "--zd-chat-user-text", bgVar: "--zd-chat-user-bg" },
  { key: "chat-assistant", label: "chatAssistantText / chatAssistantBg", tier: 1, threshold: 4.5, fgVar: "--zd-chat-assistant-text", bgVar: "--zd-chat-assistant-bg" },

  // ── Tier 2 — graphics/icons, ≥ 3.0:1 unless noted ──
  { key: "mermaid-text-vs-node-bg", label: "mermaidText / mermaidNodeBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-node-bg" },
  { key: "mermaid-text-vs-label-bg", label: "mermaidText / mermaidLabelBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-label-bg" },
  { key: "mermaid-text-vs-note-bg", label: "mermaidText / mermaidNoteBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-note-bg" },
  { key: "mermaid-line-vs-bg", label: "mermaidLine / bg", tier: 2, threshold: 3.0, fgVar: "--zd-mermaid-line", bgVar: "--zd-bg" },
  { key: "image-overlay", label: "imageOverlayFg / imageOverlayBg", tier: 2, threshold: 3.0, fgVar: "--zd-image-overlay-fg", bgVar: "--zd-image-overlay-bg" },
];

const SYNTAX_ROLES = [
  ["comment", "--zd-syntax-comment"],
  ["string", "--zd-syntax-string"],
  ["number", "--zd-syntax-number"],
  ["keyword", "--zd-syntax-keyword"],
  ["callable", "--zd-syntax-callable"],
  ["type", "--zd-syntax-type"],
  ["name", "--zd-syntax-name"],
  ["inserted", "--zd-syntax-inserted"],
  ["deleted", "--zd-syntax-deleted"],
] as const;

/** Every syntax role is checked on both the doc page and the preview fence. */
const SYNTAX_PAIR_MATRIX: PairSpec[] = SYNTAX_ROLES.flatMap(([role, fgVar]) =>
  (["doc-page", "preview"] as const).map((surface) => ({
    key: `syntax-${role}-vs-${surface}-fence`,
    label: `${fgVar} / ${surface} fence`,
    tier: 1 as const,
    threshold: 4.5,
    fgVar,
    bgVar: "--zd-code-bg",
    surface,
  })),
);

const PAINTED_DELETED_PAIR_MATRIX: PairSpec[] = [
  {
    key: "syntax-deleted-painted-vs-doc-page-fence",
    label: "--zd-syntax-deleted 15% tint / doc-page fence",
    tier: 1,
    threshold: 4.5,
    fgVar: "--zd-syntax-deleted",
    bgVar: "--zd-bg",
    tintBg: true,
    tintPct: 15,
    surface: "doc-page",
  },
  {
    key: "syntax-deleted-painted-vs-preview-fence",
    label: "--zd-syntax-deleted 15% tint / preview fence",
    tier: 1,
    threshold: 4.5,
    fgVar: "--zd-syntax-deleted",
    bgVar: "--color-bg",
    tintBg: true,
    tintPct: 15,
    surface: "preview",
  },
];

export const PAIR_MATRIX: PairSpec[] = [
  ...BASE_PAIR_MATRIX,
  ...SYNTAX_PAIR_MATRIX,
  ...PAINTED_DELETED_PAIR_MATRIX,
];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type PresetSource = "colorSchemes" | "uiColors";

export interface PairResult {
  key: string;
  label: string;
  tier: 1 | 2;
  threshold: number;
  fg: string;
  bg: string;
  ratio: number;
  pass: boolean;
}

export interface SchemeReport {
  name: string;
  source: PresetSource;
  pairs: PairResult[];
  passCount: number;
  failCount: number;
  allPass: boolean;
}

export function getAllPresets(): Array<{ name: string; scheme: ColorScheme; source: PresetSource }> {
  return Object.entries(colorSchemes).map(([name, scheme]) => ({ name, scheme, source: "colorSchemes" as const }));
}

export function evaluateScheme(name: string, scheme: ColorScheme, source: PresetSource): SchemeReport {
  const varMap = new Map(schemeToCssPairs(scheme));
  const previewVars = loadPreviewVars();
  const mode = inferMode(name, scheme);

  const pairs: PairResult[] = PAIR_MATRIX.map((spec) => {
    const preview = spec.surface === "preview";
    const fg = preview ? resolvePreviewVar(spec.fgVar, mode, previewVars) : varMap.get(spec.fgVar);
    const rawBg = preview ? resolvePreviewVar(spec.bgVar, mode, previewVars) : varMap.get(spec.bgVar);
    if (fg === undefined || rawBg === undefined) {
      throw new Error(
        `Scheme "${name}": pair "${spec.key}" references an unknown CSS var (fgVar=${spec.fgVar}, bgVar=${spec.bgVar})`,
      );
    }
    const bg = spec.tintBg ? colorMixSrgb(fg, rawBg, spec.tintPct ?? ADMONITION_TINT_PCT) : rawBg;
    const ratio = contrastRatio(fg, bg);
    return {
      key: spec.key,
      label: spec.label,
      tier: spec.tier,
      threshold: spec.threshold,
      fg,
      bg,
      ratio,
      pass: ratio >= spec.threshold,
    };
  });

  const passCount = pairs.filter((p) => p.pass).length;
  return {
    name,
    source,
    pairs,
    passCount,
    failCount: pairs.length - passCount,
    allPass: passCount === pairs.length,
  };
}

function inferMode(name: string, scheme: ColorScheme): Mode {
  if (/dark/i.test(name)) return "dark";
  if (/light/i.test(name)) return "light";
  const bg = scheme.map.bg;
  if (typeof bg !== "string" && "base" in bg) {
    return bg.base === scheme.ramps.base.length - 1 ? "dark" : "light";
  }
  return "light";
}
