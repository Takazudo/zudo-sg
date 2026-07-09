/**
 * Ramp-native color schemes (Color Ramp Restructure — zudolab/zudo-doc#2584;
 * minimize pass #2601 / #2602).
 *
 * A `ColorScheme` is `{ ramps, map }`:
 *   - `ramps` — the shared Tier-1 source of truth: a warm-neutral `base` ramp
 *     (5 stops, index 0 = lightest), an `accent` ramp (3 stops), and 4 `state`
 *     colors. Light and dark modes share these values.
 *   - `map` — the per-mode Tier-2 wiring: which ramp stop (or literal OKLCH)
 *     each UI role points at.
 *
 * The palette was minimized from base=12 / accent=7 to base=5 / accent=3.
 * Semantic roles are intentionally merged onto shared stops to keep the number
 * of distinct tones small; elevated fills often read as page-bg + border only.
 */

import type { ColorScheme, Ramps, ModeMap } from "./color-scheme-utils";

export type { ColorScheme } from "./color-scheme-utils";

const ramps: Ramps = {
  base: [
    "oklch(.965 .004 65)", // 0 — lightest (light bg / dark fg)
    "oklch(.705 .008 65)", // 1 — dark muted / light selection & mermaid fill
    "oklch(.480 .008 65)", // 2 — light muted / dark selection & mermaid note
    "oklch(.300 .006 65)", // 3 — dark codeBg / mermaid fill
    "oklch(.185 .005 65)", // 4 — darkest (dark bg / light fg)
  ],
  accent: [
    "oklch(.755 .130 64)", // 0 — dark hover
    "oklch(.700 .158 62)", // 1 — dark accent
    "oklch(.470 .120 56)", // 2 — light accent
  ],
  state: {
    danger: "oklch(.640 .170 25)",
    success: "oklch(.680 .145 145)",
    warning: "oklch(.760 .135 82)",
    info: "oklch(.680 .130 245)",
  },
};

const darkMap: ModeMap = {
  bg: { base: 4 },
  fg: { base: 0 },
  selectionBg: { base: 2 },
  selectionFg: { base: 0 },
  semantic: {
    surface: { base: 4 },
    muted: { base: 1 },
    accent: { accent: 1 },
    accentHover: { accent: 0 },
    codeBg: { base: 3 },
    codeFg: { base: 0 },
    success: { state: "success" },
    danger: "oklch(.655 .170 25)",
    warning: { state: "warning" },
    info: { state: "info" },
    mermaidNodeBg: { base: 3 },
    mermaidText: { base: 0 },
    mermaidLine: { base: 1 },
    mermaidLabelBg: { base: 3 },
    mermaidNoteBg: { base: 2 },
    chatUserBg: { accent: 1 },
    chatUserText: { base: 4 },
    chatAssistantBg: { base: 4 },
    chatAssistantText: { base: 0 },
    imageOverlayBg: { base: 4 },
    imageOverlayFg: { base: 0 },
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

const lightMap: ModeMap = {
  bg: { base: 0 },
  fg: { base: 4 },
  selectionBg: { base: 1 },
  selectionFg: { base: 4 },
  semantic: {
    surface: { base: 0 },
    muted: { base: 2 },
    accent: { accent: 2 },
    accentHover: "oklch(.400 .096 56)",
    codeBg: { base: 0 },
    codeFg: { base: 4 },
    success: "oklch(.470 .140 145)",
    danger: "oklch(.505 .170 25)",
    warning: "oklch(.490 .100 82)",
    info: "oklch(.485 .122 245)",
    mermaidNodeBg: { base: 1 },
    mermaidText: { base: 4 },
    mermaidLine: { base: 2 },
    mermaidLabelBg: { base: 1 },
    mermaidNoteBg: { base: 1 },
    chatUserBg: { accent: 1 },
    chatUserText: { base: 4 },
    chatAssistantBg: { base: 0 },
    chatAssistantText: { base: 4 },
    imageOverlayBg: { base: 4 },
    imageOverlayFg: { base: 0 },
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

export const colorSchemes: Record<string, ColorScheme> = {
  "Default Light": { ramps, map: lightMap },
  "Default Dark": { ramps, map: darkMap },
};
