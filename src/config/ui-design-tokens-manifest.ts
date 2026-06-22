/**
 * Design-token manifest for @zudo-sg/ui target-website tokens.
 *
 * This is the machine-readable manifest of the tokens that the 2nd
 * design-token panel (preview panel) will tweak on the target website.
 *
 * Source of truth: packages/ui/styles/tokens.css and
 * packages/ui/styles/colors.css. All token names and default values are
 * cross-checked against those files — do NOT hand-edit values here;
 * verify against the source CSS files.
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
 * Color tokens from `packages/ui/styles/colors.css`.
 *
 * All values use light-dark() for dual-scheme support. Defaults here are
 * the full CSS declarations including both light and dark sides.
 * Stored as read-only text rows because light-dark() expressions cannot
 * be driven by a single-axis slider.
 *
 * Coverage: ink (3), paper (1), surface (2), line (2), brand (4), accent (1),
 * success (2), danger (2), focus (1) = 18 tokens total.
 */
export const UI_COLOR_TOKENS: readonly TokenDef[] = [
  // --- Ink (foreground text) ---
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

  // --- Paper & surfaces ---
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

  // --- Lines / borders ---
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

  // --- Brand ---
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
  {
    // Foreground token for branded surfaces (consumed via `text-on-brand`).
    // Flat value (not light-dark()) — source: packages/ui/styles/colors.css.
    id: "ui-color-on-brand",
    cssVar: "--color-on-brand",
    label: "color-on-brand",
    group: "brand",
    default: "var(--palette-warm-50)",
    step: 1,
    unit: "",
    control: "text",
  },

  // --- State: accent ---
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

  // --- State: success ---
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

  // --- State: danger ---
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

  // --- Focus ring ---
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
 * Coverage: 7 horizontal (hsp-2xs → hsp-2xl) + 8 vertical (vsp-3xs → vsp-2xl)
 * = 15 tokens total.
 */
export const UI_SPACING_TOKENS: readonly TokenDef[] = [
  // --- Horizontal spacing (7 steps) ---
  { id: "ui-hsp-2xs", cssVar: "--spacing-hsp-2xs", label: "hsp-2xs", group: "hsp", default: "0.125rem",  step: 0.025, unit: "rem" },
  { id: "ui-hsp-xs",  cssVar: "--spacing-hsp-xs",  label: "hsp-xs",  group: "hsp", default: "0.375rem",  step: 0.025, unit: "rem" },
  { id: "ui-hsp-sm",  cssVar: "--spacing-hsp-sm",  label: "hsp-sm",  group: "hsp", default: "0.5rem",    step: 0.025, unit: "rem" },
  { id: "ui-hsp-md",  cssVar: "--spacing-hsp-md",  label: "hsp-md",  group: "hsp", default: "0.75rem",   step: 0.025, unit: "rem" },
  { id: "ui-hsp-lg",  cssVar: "--spacing-hsp-lg",  label: "hsp-lg",  group: "hsp", default: "1rem",      step: 0.025, unit: "rem" },
  { id: "ui-hsp-xl",  cssVar: "--spacing-hsp-xl",  label: "hsp-xl",  group: "hsp", default: "1.5rem",    step: 0.025, unit: "rem" },
  { id: "ui-hsp-2xl", cssVar: "--spacing-hsp-2xl", label: "hsp-2xl", group: "hsp", default: "2rem",      step: 0.025, unit: "rem" },

  // --- Vertical spacing (8 steps) ---
  { id: "ui-vsp-3xs", cssVar: "--spacing-vsp-3xs", label: "vsp-3xs", group: "vsp", default: "0.25rem",   step: 0.025, unit: "rem" },
  { id: "ui-vsp-2xs", cssVar: "--spacing-vsp-2xs", label: "vsp-2xs", group: "vsp", default: "0.4375rem", step: 0.025, unit: "rem" },
  { id: "ui-vsp-xs",  cssVar: "--spacing-vsp-xs",  label: "vsp-xs",  group: "vsp", default: "0.875rem",  step: 0.025, unit: "rem" },
  { id: "ui-vsp-sm",  cssVar: "--spacing-vsp-sm",  label: "vsp-sm",  group: "vsp", default: "1.25rem",   step: 0.025, unit: "rem" },
  { id: "ui-vsp-md",  cssVar: "--spacing-vsp-md",  label: "vsp-md",  group: "vsp", default: "1.5rem",    step: 0.025, unit: "rem" },
  { id: "ui-vsp-lg",  cssVar: "--spacing-vsp-lg",  label: "vsp-lg",  group: "vsp", default: "1.75rem",   step: 0.025, unit: "rem" },
  { id: "ui-vsp-xl",  cssVar: "--spacing-vsp-xl",  label: "vsp-xl",  group: "vsp", default: "2.5rem",    step: 0.025, unit: "rem" },
  { id: "ui-vsp-2xl", cssVar: "--spacing-vsp-2xl", label: "vsp-2xl", group: "vsp", default: "3.5rem",    step: 0.025, unit: "rem" },
];

/**
 * Font tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage:
 *  - font-size: xs, sm, base, lg, xl, 2xl (6 steps)
 *  - font-size--line-height: paired values for each of the 6 font sizes
 *  - font-weight: normal, medium, semibold, bold (4 steps)
 *  - leading: tight, normal, relaxed (3 steps)
 *  - font-family: sans, mono (2 families)
 * Total: 21 tokens.
 */
export const UI_FONT_TOKENS: readonly TokenDef[] = [
  // --- Font sizes (xs → 2xl, 6 steps) ---
  { id: "ui-font-size-xs",   cssVar: "--font-size-xs",   label: "font-size-xs",   group: "font-size", default: "0.75rem",  step: 0.05, unit: "rem" },
  { id: "ui-font-size-sm",   cssVar: "--font-size-sm",   label: "font-size-sm",   group: "font-size", default: "0.875rem", step: 0.05, unit: "rem" },
  { id: "ui-font-size-base", cssVar: "--font-size-base", label: "font-size-base", group: "font-size", default: "1rem",     step: 0.05, unit: "rem" },
  { id: "ui-font-size-lg",   cssVar: "--font-size-lg",   label: "font-size-lg",   group: "font-size", default: "1.25rem",  step: 0.05, unit: "rem" },
  { id: "ui-font-size-xl",   cssVar: "--font-size-xl",   label: "font-size-xl",   group: "font-size", default: "1.75rem",  step: 0.05, unit: "rem" },
  { id: "ui-font-size-2xl",  cssVar: "--font-size-2xl",  label: "font-size-2xl",  group: "font-size", default: "2.5rem",   step: 0.05, unit: "rem" },

  // --- Paired line-heights for each font size (unitless) ---
  { id: "ui-font-size-xs--line-height",   cssVar: "--font-size-xs--line-height",   label: "font-size-xs / lh",   group: "font-size-lh", default: "1.5",  step: 0.05, unit: "" },
  { id: "ui-font-size-sm--line-height",   cssVar: "--font-size-sm--line-height",   label: "font-size-sm / lh",   group: "font-size-lh", default: "1.5",  step: 0.05, unit: "" },
  { id: "ui-font-size-base--line-height", cssVar: "--font-size-base--line-height", label: "font-size-base / lh", group: "font-size-lh", default: "1.75", step: 0.05, unit: "" },
  { id: "ui-font-size-lg--line-height",   cssVar: "--font-size-lg--line-height",   label: "font-size-lg / lh",   group: "font-size-lh", default: "1.5",  step: 0.05, unit: "" },
  { id: "ui-font-size-xl--line-height",   cssVar: "--font-size-xl--line-height",   label: "font-size-xl / lh",   group: "font-size-lh", default: "1.25", step: 0.05, unit: "" },
  { id: "ui-font-size-2xl--line-height",  cssVar: "--font-size-2xl--line-height",  label: "font-size-2xl / lh",  group: "font-size-lh", default: "1.1",  step: 0.05, unit: "" },

  // --- Font weights (select) ---
  { id: "ui-font-weight-normal",   cssVar: "--font-weight-normal",   label: "font-weight-normal",   group: "font-weight", default: "400", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "ui-font-weight-medium",   cssVar: "--font-weight-medium",   label: "font-weight-medium",   group: "font-weight", default: "500", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "ui-font-weight-semibold", cssVar: "--font-weight-semibold", label: "font-weight-semibold", group: "font-weight", default: "600", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },
  { id: "ui-font-weight-bold",     cssVar: "--font-weight-bold",     label: "font-weight-bold",     group: "font-weight", default: "700", step: 1, unit: "", control: "select", options: FONT_WEIGHT_OPTIONS },

  // --- Line heights (3 steps — unitless) ---
  { id: "ui-leading-tight",   cssVar: "--leading-tight",   label: "leading-tight",   group: "line-height", default: "1.25", step: 0.05, unit: "" },
  { id: "ui-leading-normal",  cssVar: "--leading-normal",  label: "leading-normal",  group: "line-height", default: "1.5",  step: 0.05, unit: "" },
  { id: "ui-leading-relaxed", cssVar: "--leading-relaxed", label: "leading-relaxed", group: "line-height", default: "1.75", step: 0.05, unit: "" },

  // --- Font families (text input) ---
  {
    id: "ui-font-sans",
    cssVar: "--font-sans",
    label: "font-sans",
    group: "font-family",
    default: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-font-mono",
    cssVar: "--font-mono",
    label: "font-mono",
    group: "font-family",
    default: 'ui-monospace, "JetBrains Mono", "Fira Code", monospace',
    step: 1,
    unit: "",
    control: "text",
  },
];

/**
 * Size tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage:
 *  - radius: sm, md, lg, full (4 steps)
 *  - shadow: card, raised, overlay (3 steps)
 * Total: 7 tokens.
 *
 * Shadow values are read-only because they are multi-layer `box-shadow`
 * expressions that cannot be driven by a single-axis slider.
 * `--radius-full` carries a pill toggle (sentinel 9999px).
 */
export const UI_SIZE_TOKENS: readonly TokenDef[] = [
  // --- Border radius ---
  { id: "ui-radius-sm",   cssVar: "--radius-sm",   label: "radius-sm",   group: "radius", default: "0.25rem", step: 1, unit: "px" },
  { id: "ui-radius-md",   cssVar: "--radius-md",   label: "radius-md",   group: "radius", default: "0.5rem",  step: 1, unit: "px" },
  { id: "ui-radius-lg",   cssVar: "--radius-lg",   label: "radius-lg",   group: "radius", default: "1rem",    step: 1, unit: "px" },
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

  // --- Shadows (read-only — multi-layer expressions) ---
  {
    id: "ui-shadow-card",
    cssVar: "--shadow-card",
    label: "shadow-card",
    group: "shadow",
    default:
      "0 0.5px 1px oklch(0.21 0.03 264 / 0.05), 0 2px 4px oklch(0.21 0.03 264 / 0.05), 0 5px 10px oklch(0.21 0.03 264 / 0.05)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-shadow-raised",
    cssVar: "--shadow-raised",
    label: "shadow-raised",
    group: "shadow",
    default:
      "0 1px 2px oklch(0.21 0.03 264 / 0.06), 0 4px 8px oklch(0.21 0.03 264 / 0.06), 0 12px 24px oklch(0.21 0.03 264 / 0.07)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-shadow-overlay",
    cssVar: "--shadow-overlay",
    label: "shadow-overlay",
    group: "shadow",
    default:
      "0 2px 4px oklch(0.21 0.03 264 / 0.08), 0 8px 16px oklch(0.21 0.03 264 / 0.08), 0 24px 48px oklch(0.21 0.03 264 / 0.10)",
    step: 1,
    unit: "",
    control: "text",
  },
];
