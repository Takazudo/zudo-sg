/**
 * Design-token manifest for @zudo-sg/ui target-website tokens.
 *
 * GENERATED — do not hand-edit. Run `pnpm gen:token-manifest` after changing
 * packages/ui/styles/tokens.css or packages/ui/styles/colors.css, then commit
 * the regenerated output. `pnpm check:token-manifest` fails on drift.
 *
 * Source of truth: packages/ui/styles/tokens.css and packages/ui/styles/colors.css,
 * parsed by scripts/gen-token-manifest.mjs (scripts/lib/ui-token-manifest.mjs).
 * Only `default` values are derived from the CSS; `group`/`step`/`unit`/
 * `control`/`options`/`pill` are presentation metadata with no CSS
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
 * Tier-1 raw palette colors from `packages/ui/styles/colors.css` (the `:root`
 * `--palette-{family}-{step}` block). This is the raw material beneath the
 * semantic `--color-*` tokens in UI_COLOR_TOKENS below — same three-tier
 * model the doc-chrome panel exposes via its 16-rung `--zd-*` palette.
 *
 * These are plain name/value descriptors (NOT `TokenDef`) because zdtp's
 * `TokenDef.control` has no `"color"` option — the preview panel builds them
 * into `{ kind: "color" }` TierItems inline, mirroring the doc panel's
 * `buildPaletteTier()`. Rendered as a "Palette" swatch tier in the preview
 * panel's Color tab; editing a swatch pushes `--palette-*` to the preview
 * iframes via the sink, cascading into every semantic token that references it.
 *
 * Coverage: 32 colors.
 */
export interface UiPaletteColor {
  /** Palette key without the `--palette-` prefix, e.g. "cool-700". */
  name: string;
  /** Raw oklch value, from colors.css. */
  value: string;
}

export const UI_PALETTE_COLORS: readonly UiPaletteColor[] = [
  { name: "white", value: "oklch(1 0 0)" },
  { name: "cool-50", value: "oklch(0.93 0.01 264)" },
  { name: "cool-100", value: "oklch(0.72 0.015 264)" },
  { name: "cool-200", value: "oklch(0.58 0.015 264)" },
  { name: "cool-250", value: "oklch(0.58 0.012 264)" },
  { name: "cool-300", value: "oklch(0.44 0.02 264)" },
  { name: "cool-400", value: "oklch(0.42 0.016 264)" },
  { name: "cool-500", value: "oklch(0.32 0.014 264)" },
  { name: "cool-600", value: "oklch(0.25 0.014 264)" },
  { name: "cool-700", value: "oklch(0.21 0.03 264)" },
  { name: "cool-750", value: "oklch(0.21 0.012 264)" },
  { name: "cool-800", value: "oklch(0.17 0.01 264)" },
  { name: "warm-50", value: "oklch(0.99 0.004 90)" },
  { name: "warm-100", value: "oklch(0.97 0.006 90)" },
  { name: "warm-200", value: "oklch(0.91 0.008 90)" },
  { name: "warm-300", value: "oklch(0.83 0.01 90)" },
  { name: "brand-100", value: "oklch(0.96 0.03 200)" },
  { name: "brand-300", value: "oklch(0.82 0.11 200)" },
  { name: "brand-400", value: "oklch(0.74 0.12 200)" },
  { name: "brand-600", value: "oklch(0.52 0.13 200)" },
  { name: "brand-700", value: "oklch(0.44 0.13 200)" },
  { name: "brand-800", value: "oklch(0.30 0.05 200)" },
  { name: "accent-300", value: "oklch(0.78 0.14 55)" },
  { name: "accent-500", value: "oklch(0.70 0.16 55)" },
  { name: "success-100", value: "oklch(0.95 0.04 155)" },
  { name: "success-300", value: "oklch(0.74 0.14 155)" },
  { name: "success-600", value: "oklch(0.55 0.14 155)" },
  { name: "success-800", value: "oklch(0.30 0.05 155)" },
  { name: "danger-100", value: "oklch(0.95 0.04 25)" },
  { name: "danger-300", value: "oklch(0.72 0.16 25)" },
  { name: "danger-600", value: "oklch(0.55 0.18 25)" },
  { name: "danger-800", value: "oklch(0.30 0.06 25)" },
];

/**
 * Color tokens from `packages/ui/styles/colors.css`.
 *
 * All values use light-dark() for dual-scheme support. Defaults here are
 * the full CSS declarations including both light and dark sides.
 * Stored as read-only text rows because light-dark() expressions cannot
 * be driven by a single-axis slider.
 *
 * Coverage: 18 tokens total.
 */
export const UI_COLOR_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-color-ink",
    cssVar: "--color-ink",
    label: "color-ink",
    group: "ink",
    default: "light-dark(var(--palette-cool-700), var(--palette-cool-50))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-ink-soft",
    cssVar: "--color-ink-soft",
    label: "color-ink-soft",
    group: "ink",
    default: "light-dark(var(--palette-cool-300), var(--palette-cool-100))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-ink-mute",
    cssVar: "--color-ink-mute",
    label: "color-ink-mute",
    group: "ink",
    default: "light-dark(var(--palette-cool-200), var(--palette-cool-250))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-paper",
    cssVar: "--color-paper",
    label: "color-paper",
    group: "surface",
    default: "light-dark(var(--palette-warm-50), var(--palette-cool-800))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-surface",
    cssVar: "--color-surface",
    label: "color-surface",
    group: "surface",
    default: "light-dark(var(--palette-white), var(--palette-cool-750))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-surface-sunken",
    cssVar: "--color-surface-sunken",
    label: "color-surface-sunken",
    group: "surface",
    default: "light-dark(var(--palette-warm-100), var(--palette-cool-600))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-line",
    cssVar: "--color-line",
    label: "color-line",
    group: "line",
    default: "light-dark(var(--palette-warm-200), var(--palette-cool-500))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-line-strong",
    cssVar: "--color-line-strong",
    label: "color-line-strong",
    group: "line",
    default: "light-dark(var(--palette-warm-300), var(--palette-cool-400))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-brand",
    cssVar: "--color-brand",
    label: "color-brand",
    group: "brand",
    default: "light-dark(var(--palette-brand-600), var(--palette-brand-400))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-brand-strong",
    cssVar: "--color-brand-strong",
    label: "color-brand-strong",
    group: "brand",
    default: "light-dark(var(--palette-brand-700), var(--palette-brand-300))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-brand-soft",
    cssVar: "--color-brand-soft",
    label: "color-brand-soft",
    group: "brand",
    default: "light-dark(var(--palette-brand-100), var(--palette-brand-800))",
    step: 1,
    unit: "",
    control: "text",
  },
  // Foreground token for branded surfaces (consumed via `text-on-brand`). Flat value (not light-dark()).
  {
    id: "ui-color-on-brand",
    cssVar: "--color-on-brand",
    label: "color-on-brand",
    group: "brand",
    default: "var(--palette-warm-50)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-accent",
    cssVar: "--color-accent",
    label: "color-accent",
    group: "state",
    default: "light-dark(var(--palette-accent-500), var(--palette-accent-300))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-success",
    cssVar: "--color-success",
    label: "color-success",
    group: "state",
    default: "light-dark(var(--palette-success-600), var(--palette-success-300))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-success-soft",
    cssVar: "--color-success-soft",
    label: "color-success-soft",
    group: "state",
    default: "light-dark(var(--palette-success-100), var(--palette-success-800))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-danger",
    cssVar: "--color-danger",
    label: "color-danger",
    group: "state",
    default: "light-dark(var(--palette-danger-600), var(--palette-danger-300))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-danger-soft",
    cssVar: "--color-danger-soft",
    label: "color-danger-soft",
    group: "state",
    default: "light-dark(var(--palette-danger-100), var(--palette-danger-800))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-focus",
    cssVar: "--color-focus",
    label: "color-focus",
    group: "state",
    default: "light-dark(var(--palette-brand-600), var(--palette-brand-400))",
    step: 1,
    unit: "",
    control: "text",
  },
];

/**
 * Spacing tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage: 15 tokens total.
 */
export const UI_SPACING_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-hsp-2xs",
    cssVar: "--spacing-hsp-2xs",
    label: "hsp-2xs",
    group: "hsp",
    default: "0.125rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-xs",
    cssVar: "--spacing-hsp-xs",
    label: "hsp-xs",
    group: "hsp",
    default: "0.375rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-sm",
    cssVar: "--spacing-hsp-sm",
    label: "hsp-sm",
    group: "hsp",
    default: "0.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-md",
    cssVar: "--spacing-hsp-md",
    label: "hsp-md",
    group: "hsp",
    default: "0.75rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-lg",
    cssVar: "--spacing-hsp-lg",
    label: "hsp-lg",
    group: "hsp",
    default: "1rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-xl",
    cssVar: "--spacing-hsp-xl",
    label: "hsp-xl",
    group: "hsp",
    default: "1.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-2xl",
    cssVar: "--spacing-hsp-2xl",
    label: "hsp-2xl",
    group: "hsp",
    default: "2rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-3xs",
    cssVar: "--spacing-vsp-3xs",
    label: "vsp-3xs",
    group: "vsp",
    default: "0.25rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-2xs",
    cssVar: "--spacing-vsp-2xs",
    label: "vsp-2xs",
    group: "vsp",
    default: "0.4375rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-xs",
    cssVar: "--spacing-vsp-xs",
    label: "vsp-xs",
    group: "vsp",
    default: "0.875rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-sm",
    cssVar: "--spacing-vsp-sm",
    label: "vsp-sm",
    group: "vsp",
    default: "1.25rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-md",
    cssVar: "--spacing-vsp-md",
    label: "vsp-md",
    group: "vsp",
    default: "1.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-lg",
    cssVar: "--spacing-vsp-lg",
    label: "vsp-lg",
    group: "vsp",
    default: "1.75rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-xl",
    cssVar: "--spacing-vsp-xl",
    label: "vsp-xl",
    group: "vsp",
    default: "2.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-2xl",
    cssVar: "--spacing-vsp-2xl",
    label: "vsp-2xl",
    group: "vsp",
    default: "3.5rem",
    step: 0.025,
    unit: "rem",
  },
];

/**
 * Font tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage: 21 tokens total.
 */
export const UI_FONT_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-text-xs",
    cssVar: "--text-xs",
    label: "text-xs",
    group: "font-size",
    default: "0.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-sm",
    cssVar: "--text-sm",
    label: "text-sm",
    group: "font-size",
    default: "0.875rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-base",
    cssVar: "--text-base",
    label: "text-base",
    group: "font-size",
    default: "1rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-lg",
    cssVar: "--text-lg",
    label: "text-lg",
    group: "font-size",
    default: "1.25rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-xl",
    cssVar: "--text-xl",
    label: "text-xl",
    group: "font-size",
    default: "1.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-2xl",
    cssVar: "--text-2xl",
    label: "text-2xl",
    group: "font-size",
    default: "2.5rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-xs--line-height",
    cssVar: "--text-xs--line-height",
    label: "text-xs / lh",
    group: "font-size-lh",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-sm--line-height",
    cssVar: "--text-sm--line-height",
    label: "text-sm / lh",
    group: "font-size-lh",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-base--line-height",
    cssVar: "--text-base--line-height",
    label: "text-base / lh",
    group: "font-size-lh",
    default: "1.75",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-lg--line-height",
    cssVar: "--text-lg--line-height",
    label: "text-lg / lh",
    group: "font-size-lh",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-xl--line-height",
    cssVar: "--text-xl--line-height",
    label: "text-xl / lh",
    group: "font-size-lh",
    default: "1.25",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-2xl--line-height",
    cssVar: "--text-2xl--line-height",
    label: "text-2xl / lh",
    group: "font-size-lh",
    default: "1.1",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-font-weight-normal",
    cssVar: "--font-weight-normal",
    label: "font-weight-normal",
    group: "font-weight",
    default: "400",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-font-weight-medium",
    cssVar: "--font-weight-medium",
    label: "font-weight-medium",
    group: "font-weight",
    default: "500",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-font-weight-semibold",
    cssVar: "--font-weight-semibold",
    label: "font-weight-semibold",
    group: "font-weight",
    default: "600",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-font-weight-bold",
    cssVar: "--font-weight-bold",
    label: "font-weight-bold",
    group: "font-weight",
    default: "700",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-leading-tight",
    cssVar: "--leading-tight",
    label: "leading-tight",
    group: "line-height",
    default: "1.25",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-leading-normal",
    cssVar: "--leading-normal",
    label: "leading-normal",
    group: "line-height",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-leading-relaxed",
    cssVar: "--leading-relaxed",
    label: "leading-relaxed",
    group: "line-height",
    default: "1.75",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-font-sans",
    cssVar: "--font-sans",
    label: "font-sans",
    group: "font-family",
    default: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-font-mono",
    cssVar: "--font-mono",
    label: "font-mono",
    group: "font-family",
    default: "ui-monospace, \"JetBrains Mono\", \"Fira Code\", monospace",
    step: 1,
    unit: "",
    control: "text",
  },
];

/**
 * Size tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage: 7 tokens total.
 * `--radius-full` carries a pill toggle (sentinel 9999px).
 */
export const UI_SIZE_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-radius-sm",
    cssVar: "--radius-sm",
    label: "radius-sm",
    group: "radius",
    default: "0.25rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-md",
    cssVar: "--radius-md",
    label: "radius-md",
    group: "radius",
    default: "0.5rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-lg",
    cssVar: "--radius-lg",
    label: "radius-lg",
    group: "radius",
    default: "1rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-full",
    cssVar: "--radius-full",
    label: "radius-full",
    group: "radius",
    default: "9999px",
    step: 1,
    unit: "px",
    pill: { value: "9999px", customDefault: "16px" },
  },
  {
    id: "ui-shadow-card",
    cssVar: "--shadow-card",
    label: "shadow-card",
    group: "shadow",
    default: "0 0.5px 1px oklch(0.21 0.03 264 / 0.05), 0 2px 4px oklch(0.21 0.03 264 / 0.05), 0 5px 10px oklch(0.21 0.03 264 / 0.05)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-shadow-raised",
    cssVar: "--shadow-raised",
    label: "shadow-raised",
    group: "shadow",
    default: "0 1px 2px oklch(0.21 0.03 264 / 0.06), 0 4px 8px oklch(0.21 0.03 264 / 0.06), 0 12px 24px oklch(0.21 0.03 264 / 0.07)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-shadow-overlay",
    cssVar: "--shadow-overlay",
    label: "shadow-overlay",
    group: "shadow",
    default: "0 2px 4px oklch(0.21 0.03 264 / 0.08), 0 8px 16px oklch(0.21 0.03 264 / 0.08), 0 24px 48px oklch(0.21 0.03 264 / 0.10)",
    step: 1,
    unit: "",
    control: "text",
  },
];
